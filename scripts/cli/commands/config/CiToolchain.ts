import * as fs from "node:fs";
import * as path from "node:path";
import { detectTestCommand, withBuild } from "../../../harness/init";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";

/**
 * What the CI job needs so the gate can run the project's tests, not only read
 * its specification (#70). The job used to install Node and run
 * `validate . --strict`: on a Spring Boot project with a class deleted it
 * stayed green, because nothing in it had a JDK or ran `mvn test`.
 */
export type CiStackKind = "maven" | "gradle" | "node" | "go" | "python" | "unknown";

export interface CiPlan {
  kind: CiStackKind;
  javaVersion: string;
  /** The command the job's gate step runs. */
  gateCmd: string;
  /** Where the test command came from, for the message `ci init` prints. */
  testSource: "config" | "detected" | "none";
  testCmd: string | null;
}

const DEFAULT_JAVA = "21";

function read(projectDir: string, rel: string): string | null {
  try {
    return fs.readFileSync(path.join(projectDir, rel), "utf8");
  } catch {
    return null;
  }
}

function plainVersion(v: string | undefined): string | null {
  const t = (v || "").trim().replace(/^1\./, "");
  return /^\d{1,2}$/.test(t) ? t : null;
}

export function javaVersion(projectDir: string): string {
  const pom = read(projectDir, "pom.xml");
  if (pom !== null) {
    const tags = [
      /<java\.version>([^<]+)</,
      /<maven\.compiler\.release>([^<]+)</,
      /<maven\.compiler\.source>([^<]+)</,
    ];
    for (const tag of tags) {
      const v = plainVersion(tag.exec(pom)?.[1]);
      if (v) return v;
    }
    return DEFAULT_JAVA;
  }
  const gradle = read(projectDir, "build.gradle.kts") ?? read(projectDir, "build.gradle") ?? "";
  const patterns = [
    /JavaLanguageVersion\.of\(\s*(\d{1,2})\s*\)/,
    /JavaVersion\.VERSION_(?:1_)?(\d{1,2})\b/,
    /sourceCompatibility\s*=\s*['"]?(\d{1,2}(?:\.\d)?)['"]?/,
  ];
  for (const p of patterns) {
    const v = plainVersion(p.exec(gradle)?.[1]);
    if (v) return v;
  }
  return DEFAULT_JAVA;
}

export function stackKind(projectDir: string): CiStackKind {
  const has = (rel: string) => fs.existsSync(path.join(projectDir, rel));
  if (has("pom.xml")) return "maven";
  if (has("build.gradle") || has("build.gradle.kts")) return "gradle";
  if (has("package.json")) return "node";
  if (has("go.mod")) return "go";
  if (has("pyproject.toml") || has("setup.py") || has("requirements.txt")) return "python";
  return "unknown";
}

/** Single-quoted for a POSIX shell. */
export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function planCi(projectDir: string, version: string): CiPlan {
  const kind = stackKind(projectDir);
  const npx = `npx @rsaglobaltech/specgate@${version}`;
  let configured: string | null = null;
  try {
    configured = readHarnessConfig(projectDir)?.testCmd ?? null;
  } catch {
    configured = null;
  }
  const base = { kind, javaVersion: javaVersion(projectDir) };
  if (configured) {
    // `check` reads test_cmd from harness.config.yaml, so a later
    // `config set test_cmd` changes CI too, with no second place to edit.
    return { ...base, gateCmd: `${npx} check .`, testSource: "config", testCmd: configured };
  }
  const detected = withBuild(projectDir, detectTestCommand(projectDir));
  if (detected) {
    return {
      ...base,
      gateCmd: `${npx} check . --test-cmd ${shQuote(detected)}`,
      testSource: "detected",
      testCmd: detected,
    };
  }
  return { ...base, gateCmd: `${npx} validate . --strict`, testSource: "none", testCmd: null };
}

const NODE_VERSION = "22";

function indent(lines: string[], n: number): string {
  const pad = " ".repeat(n);
  return lines.map((l) => (l ? pad + l : l)).join("\n");
}

/** GitHub Actions steps after checkout, indented for `steps:`. */
export function githubSetup(plan: CiPlan, projectDir: string): string {
  const steps: string[] = [
    "- uses: actions/setup-node@v4",
    "  with:",
    `    node-version: '${NODE_VERSION}'`,
  ];
  if (plan.kind === "maven" || plan.kind === "gradle") {
    steps.push(
      "- uses: actions/setup-java@v4",
      "  with:",
      "    distribution: temurin",
      `    java-version: '${plan.javaVersion}'`,
      `    cache: ${plan.kind}`
    );
  } else if (plan.kind === "node") {
    const lock = fs.existsSync(path.join(projectDir, "package-lock.json"));
    steps.push(`- run: ${lock ? "npm ci" : "npm install"}`);
  } else if (plan.kind === "go") {
    steps.push("- uses: actions/setup-go@v5", "  with:", "    go-version-file: go.mod");
  } else if (plan.kind === "python") {
    steps.push(
      "- uses: actions/setup-python@v5",
      "  with:",
      "    python-version: '3.12'",
      "# Install what your tests need, e.g. pip install -r requirements.txt"
    );
  }
  return indent(steps, 6);
}

/** Azure Pipelines steps before the gate, indented for `steps:`. */
export function azureSetup(plan: CiPlan, projectDir: string): string {
  const steps: string[] = [
    "- task: NodeTool@0",
    "  inputs:",
    `    versionSpec: '${NODE_VERSION}.x'`,
    `  displayName: Use Node.js ${NODE_VERSION}`,
  ];
  if (plan.kind === "maven" || plan.kind === "gradle") {
    steps.push(
      "- task: JavaToolInstaller@0",
      "  inputs:",
      `    versionSpec: '${plan.javaVersion}'`,
      "    jdkArchitectureOption: x64",
      "    jdkSourceOption: PreInstalled",
      `  displayName: Use Java ${plan.javaVersion}`
    );
  } else if (plan.kind === "node") {
    const lock = fs.existsSync(path.join(projectDir, "package-lock.json"));
    steps.push(
      `- script: ${lock ? "npm ci" : "npm install"}`,
      "  displayName: Install dependencies"
    );
  } else if (plan.kind === "go") {
    steps.push("- task: GoTool@0", "  inputs:", "    version: '1.22'");
  } else if (plan.kind === "python") {
    steps.push(
      "- task: UsePythonVersion@0",
      "  inputs:",
      "    versionSpec: '3.12'",
      "# Install what your tests need, e.g. pip install -r requirements.txt"
    );
  }
  return indent(steps, 2);
}

/** The container image a GitLab or Jenkins job runs in. */
export function ciImage(plan: CiPlan): string {
  switch (plan.kind) {
    case "maven":
      return `maven:3-eclipse-temurin-${plan.javaVersion}`;
    case "gradle":
      return `gradle:jdk${plan.javaVersion}`;
    case "go":
      return "golang:1";
    case "python":
      return "python:3.12";
    default:
      return `node:${NODE_VERSION}`;
  }
}

/**
 * Shell lines run before the gate in a container job. A JDK, Go or Python image
 * has no Node, and Specgate runs on Node: the official tarball is fetched and
 * checked against the release's SHASUMS256.txt before it is unpacked. It goes
 * to /tmp, not the workspace — a Jenkins agent runs as a user that cannot write
 * /usr/local, and node's files inside the repository would be scanned as the
 * project's own. The lines share one shell, so PATH holds for the gate.
 */
export function containerSetup(plan: CiPlan, projectDir: string): string[] {
  if (plan.kind === "unknown") return [];
  if (plan.kind === "node") {
    const lock = fs.existsSync(path.join(projectDir, "package-lock.json"));
    return [lock ? "npm ci" : "npm install"];
  }
  const base = `https://nodejs.org/dist/latest-v${NODE_VERSION}.x`;
  return [
    "NODE_DIR=/tmp/specgate-node && mkdir -p $NODE_DIR && cd $NODE_DIR",
    `curl -fsSLO ${base}/SHASUMS256.txt`,
    "ARCH=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')",
    `NODE_TGZ=$(grep -o "node-v${NODE_VERSION}[.0-9]*-linux-$ARCH.tar.gz" SHASUMS256.txt | head -1)`,
    `curl -fsSLO "${base}/$NODE_TGZ"`,
    "sha256sum -c --ignore-missing SHASUMS256.txt",
    'tar -xzf "$NODE_TGZ" --strip-components=1 && cd - > /dev/null',
    'export PATH="$NODE_DIR/bin:$PATH"',
  ];
}

export function describeTests(plan: CiPlan): string {
  if (plan.testSource === "config") return `runs your tests: \`${plan.testCmd}\` (test_cmd)`;
  if (plan.testSource === "detected")
    return `runs your tests: \`${plan.testCmd}\` (detected — \`specgate config set test_cmd\` and re-run to change it)`;
  return 'runs no tests: none detected — `specgate config set test_cmd "<command>"`, then re-run `ci init --force`';
}

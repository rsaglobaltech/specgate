import * as fs from "node:fs";
import * as path from "node:path";

/**
 * The checks of a level for the stack a project uses (REQ-225, ADR-0040).
 *
 * Every preset runs in Docker (REQ-232: the person's decision for the first
 * delivery), with tools that need no account. Each command here was run
 * against a real project in its image before it was written down; the
 * versions are pinned so a preset does not change under a team.
 */

export type Level = "basic" | "strict";
export type Stack = "maven" | "gradle" | "node";

/** Images, pinned. Refreshed with the presets, in a release. */
export const IMAGES = {
  gitleaks: "ghcr.io/gitleaks/gitleaks:v8.24.3",
  semgrep: "semgrep/semgrep:1.99.0",
  osv: "ghcr.io/google/osv-scanner:v2.0.2",
  node: "node:22",
};

const read = (dir: string, rel: string) => {
  try {
    return fs.readFileSync(path.join(dir, rel), "utf8");
  } catch {
    return "";
  }
};

/** The stacks a project's build files give away, in the order presets are written. */
export function detectStacks(projectDir: string): Stack[] {
  const has = (rel: string) => fs.existsSync(path.join(projectDir, rel));
  const out: Stack[] = [];
  if (has("pom.xml")) out.push("maven");
  if (has("build.gradle") || has("build.gradle.kts")) out.push("gradle");
  if (has("package.json")) out.push("node");
  return out;
}

/** The JDK a Java build declares (release, source or java.version), 21 when it says none. */
export function javaVersion(projectDir: string): number {
  const text = `${read(projectDir, "pom.xml")}\n${read(projectDir, "build.gradle")}\n${read(projectDir, "build.gradle.kts")}`;
  const m =
    /<maven\.compiler\.(?:release|source)>(\d+)</.exec(text) ||
    /<java\.version>(\d+)</.exec(text) ||
    /languageVersion\s*(?:=|\.set\()\s*JavaLanguageVersion\.of\((\d+)\)/.exec(text) ||
    /sourceCompatibility\s*=\s*(?:JavaVersion\.VERSION_)?['"]?(\d+)/.exec(text);
  const v = m ? Number(m[1]) : 21;
  return [17, 21, 25].includes(v) ? v : v < 17 ? 17 : 21;
}

/** The lockfile and how to install in a node container. */
function nodeInstall(projectDir: string): { lock: string; install: string } {
  const has = (rel: string) => fs.existsSync(path.join(projectDir, rel));
  if (has("pnpm-lock.yaml"))
    return {
      lock: "pnpm-lock.yaml",
      install: "corepack enable && pnpm install --frozen-lockfile --reporter=silent",
    };
  if (has("yarn.lock"))
    return {
      lock: "yarn.lock",
      install: "corepack enable && yarn install --frozen-lockfile --silent",
    };
  return { lock: "package-lock.json", install: "npm ci --no-audit --no-fund --silent" };
}

interface PresetCheck {
  name: string;
  run: string;
  when: "attempt" | "end" | "ci";
  image: string;
  sarif?: string;
  report?: string;
  network?: boolean;
  volumes?: string[];
  gate?: boolean;
  timeout?: number;
  /** Written commented, with why, when the build lacks what it needs. */
  missing?: string;
  scope?: "diff" | "all";
}

const q = (s: string) => JSON.stringify(s);

function render(c: PresetCheck): string[] {
  const lines = [
    `  - name: ${c.name}`,
    `    run: ${q(c.run)}`,
    `    when: ${c.when}`,
    ...(c.gate === false ? ["    gate: false"] : []),
    "    runner: docker",
    `    image: ${c.image}`,
    ...(c.network === false ? ["    network: false"] : []),
    ...(c.volumes && c.volumes.length ? [`    volumes: [${c.volumes.join(", ")}]`] : []),
    ...(c.sarif ? [`    sarif: ${c.sarif}`] : []),
    ...(c.report ? [`    report: ${c.report}`] : []),
    ...(c.scope ? [`    scope: ${c.scope}`] : []),
    ...(c.timeout ? [`    timeout: ${c.timeout}`] : []),
  ];
  return c.missing ? [`  # ${c.missing}`, ...lines.map((l) => `  #${l.slice(1)}`)] : lines;
}

/** The secrets and dependency checks every stack shares. */
function shared(projectDir: string, level: Level, depsLock: string): PresetCheck[] {
  // osv-scanner reads a lockfile (or pom.xml); without one it finds nothing to
  // scan and writes no SARIF, so the check would fail on every run.
  const lockMissing = !fs.existsSync(path.join(projectDir, depsLock))
    ? `Dependencies need ${depsLock}, which this project does not have yet; once it does, uncomment:`
    : undefined;
  return [
    {
      name: "secrets",
      run: "gitleaks dir . --no-banner --report-format sarif --report-path .specgate/quality/gitleaks.sarif",
      when: "attempt",
      image: IMAGES.gitleaks,
      network: false,
      sarif: ".specgate/quality/gitleaks.sarif",
    },
    {
      name: "dependencies",
      run: `/osv-scanner scan source -L ${depsLock} --format sarif --output .specgate/quality/osv.sarif`,
      when: level === "strict" ? "attempt" : "end",
      image: IMAGES.osv,
      sarif: ".specgate/quality/osv.sarif",
      scope: "all",
      missing: lockMissing,
    },
  ];
}

function maven(projectDir: string, level: Level): PresetCheck[] {
  const pom = read(projectDir, "pom.xml");
  const image = `maven:3.9-eclipse-temurin-${javaVersion(projectDir)}`;
  const m2 = ["specgate-m2:/root/.m2"];
  const mvn = "mvn -B -q";
  const checks: PresetCheck[] = [
    ...shared(projectDir, level, "pom.xml"),
    {
      name: "coverage",
      run: `${mvn} org.jacoco:jacoco-maven-plugin:0.8.12:prepare-agent test org.jacoco:jacoco-maven-plugin:0.8.12:report`,
      when: "attempt",
      image,
      volumes: m2,
      report: "jacoco:target/site/jacoco/jacoco.xml",
      timeout: 1800,
    },
    {
      name: "spotbugs",
      run: `${mvn} compile com.github.spotbugs:spotbugs-maven-plugin:4.8.6.6:spotbugs -Dspotbugs.sarifOutput=true`,
      when: level === "strict" ? "attempt" : "end",
      image,
      volumes: m2,
      sarif: "target/spotbugsSarif.json",
    },
  ];
  if (level === "strict") {
    checks.push(
      {
        name: "pmd",
        run: `${mvn} org.apache.maven.plugins:maven-pmd-plugin:3.26.0:pmd -Dformat=net.sourceforge.pmd.renderers.SarifRenderer -DlinkXRef=false`,
        when: "attempt",
        image,
        volumes: m2,
        sarif: "target/pmd.sarif.json",
      },
      {
        name: "semgrep",
        run: "semgrep scan --config p/java --sarif --output .specgate/quality/semgrep.sarif --metrics off --quiet",
        when: "end",
        image: IMAGES.semgrep,
        sarif: ".specgate/quality/semgrep.sarif",
      },
      {
        name: "mutation",
        run: `${mvn} test-compile org.pitest:pitest-maven:mutationCoverage -DtargetClasses={changed_classes} -DoutputFormats=XML -DtimestampedReports=false`,
        when: "end",
        image,
        volumes: m2,
        report: "pit:target/pit-reports/mutations.xml",
        timeout: 3600,
        missing: /pitest-maven/.test(pom)
          ? undefined
          : "Mutation needs pitest-maven with pitest-junit5-plugin declared in pom.xml (JUnit 5 cannot be added from the command line); add them and uncomment:",
      }
    );
  }
  return checks;
}

function gradle(projectDir: string, level: Level): PresetCheck[] {
  const build = `${read(projectDir, "build.gradle")}\n${read(projectDir, "build.gradle.kts")}`;
  // osv-scanner reads Gradle's lockfile, not the build script: dependency locking must be on.
  const lock = "gradle.lockfile";
  const image = `gradle:8-jdk${javaVersion(projectDir)}`;
  const cache = ["specgate-gradle:/home/gradle/.gradle"];
  const checks: PresetCheck[] = [
    ...shared(projectDir, level, lock),
    {
      name: "coverage",
      run: "gradle --no-daemon -q test jacocoTestReport",
      when: "attempt",
      image,
      volumes: cache,
      report: "jacoco:build/reports/jacoco/test/jacocoTestReport.xml",
      timeout: 1800,
      missing: /\bjacoco\b/.test(build)
        ? undefined
        : "Coverage needs the jacoco plugin applied, with reports { xml.required = true }; add it and uncomment:",
    },
  ];
  if (level === "strict") {
    checks.push({
      name: "semgrep",
      run: "semgrep scan --config p/java --sarif --output .specgate/quality/semgrep.sarif --metrics off --quiet",
      when: "end",
      image: IMAGES.semgrep,
      sarif: ".specgate/quality/semgrep.sarif",
    });
  }
  return checks;
}

function node(projectDir: string, level: Level): PresetCheck[] {
  let pkg: { devDependencies?: Record<string, string>; dependencies?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(read(projectDir, "package.json") || "{}");
  } catch {
    pkg = {};
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const { lock, install } = nodeInstall(projectDir);
  const slug =
    path
      .basename(projectDir)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project";
  // node_modules lives in a volume: the host's may hold another platform's binaries.
  const volumes = [`specgate-nm-${slug}:/src/node_modules`, "specgate-npm:/root/.npm"];
  const inNode = (cmd: string) => `${install} && ${cmd}`;
  const tsconfig = fs.existsSync(path.join(projectDir, "tsconfig.json"));
  const runner = deps.vitest ? "vitest" : deps.jest ? "jest" : "";
  const checks: PresetCheck[] = [...shared(projectDir, level, lock)];
  if (tsconfig) {
    checks.push({
      name: "types",
      run: inNode("npx --no-install tsc --noEmit"),
      when: "attempt",
      image: IMAGES.node,
      volumes,
    });
  }
  if (deps.eslint) {
    checks.push({
      name: "lint",
      run: inNode("npx --no-install eslint ."),
      when: "attempt",
      image: IMAGES.node,
      volumes,
    });
  }
  checks.push({
    name: "coverage",
    run: inNode(
      runner === "jest"
        ? "npx --no-install jest --coverage --coverageReporters=lcov"
        : "npx --no-install vitest run --coverage --coverage.reporter=lcov"
    ),
    when: "attempt",
    image: IMAGES.node,
    volumes,
    report: "lcov:coverage/lcov.info",
    timeout: 1800,
    missing: runner
      ? runner === "vitest" && !deps["@vitest/coverage-v8"] && !deps["@vitest/coverage-istanbul"]
        ? "Coverage needs @vitest/coverage-v8 in devDependencies; add it and uncomment:"
        : undefined
      : "Coverage needs Vitest or Jest; with one installed, uncomment:",
  });
  if (level === "strict") {
    checks.push(
      {
        name: "semgrep",
        run: "semgrep scan --config p/typescript --config p/react --sarif --output .specgate/quality/semgrep.sarif --metrics off --quiet",
        when: "end",
        image: IMAGES.semgrep,
        sarif: ".specgate/quality/semgrep.sarif",
      },
      {
        name: "mutation",
        run: inNode("npx --no-install stryker run --mutate {changed_src} --reporters json"),
        when: "end",
        image: IMAGES.node,
        volumes,
        report: "stryker:reports/mutation/mutation.json",
        timeout: 3600,
        missing: deps["@stryker-mutator/core"]
          ? undefined
          : "Mutation needs @stryker-mutator/core and its runner in devDependencies; add them and uncomment:",
      }
    );
  }
  return checks;
}

/** The `quality:` block a level writes for a project, as YAML lines. */
export function presetYaml(projectDir: string, level: Level): string {
  const stacks = detectStacks(projectDir);
  const lines = [
    "# Quality and security checks (ADR-0040), written by `specgate quality init`.",
    "# Every check runs in Docker, with tools that need no account. Take the",
    "# baseline once (`specgate quality baseline`) so only new findings fail.",
    `quality: ${level}`,
    "checks:",
    // REQ-234: Specgate checks this itself — no tool, so no container either.
    "  - name: commits",
    '    run: "builtin:commits"',
    "    when: attempt",
    "    runner: local",
  ];
  const sonar = [
    "  # SonarQube Community in Docker (REQ-226): starts a local server on first use",
    "  # (about 2 GB of memory) at http://127.0.0.1:9123, login admin/admin. Uncomment:",
    "  # - name: sonar",
    '  #   run: "builtin:sonar"',
    "  #   when: end",
    "  #   runner: docker",
    "  #   sarif: .specgate/quality/sonar.sarif",
    "  #   timeout: 1800",
    // REQ-227: a second agent reads the change against the requirement; it advises.
    "  - name: review",
    '    run: "builtin:review"',
    "    when: end",
    "    gate: false",
    "    runner: local",
  ];
  const seen = new Set<string>(["commits"]);
  for (const stack of stacks.length ? stacks : (["node"] as Stack[])) {
    const checks =
      stack === "maven"
        ? maven(projectDir, level)
        : stack === "gradle"
          ? gradle(projectDir, level)
          : node(projectDir, level);
    for (const c of checks) {
      // One secrets scan for the whole repository; per-stack checks get the stack's name.
      const name = seen.has(c.name) ? `${c.name}-${stack}` : c.name;
      if (seen.has(c.name) && (c.name === "secrets" || c.name === "semgrep")) continue;
      seen.add(name);
      lines.push(...render({ ...c, name }));
    }
  }
  if (level === "strict") lines.push(...sonar);
  return lines.join("\n") + "\n";
}

/** Keys the quality block owns in harness.config.yaml. */
const OWNED = ["quality", "diff_coverage", "mutation_score", "checks"];

/**
 * harness.config.yaml with its quality block replaced by this one: every
 * other line kept, the block's own comment lines dropped with it.
 */
export function withPreset(config: string, preset: string): string {
  const lines = config.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const top = /^([a-z_]+):/.exec(line);
    if (top) skipping = OWNED.includes(top[1]);
    else if (skipping && !/^(\s|#|$)/.test(line)) skipping = false;
    if (skipping) continue;
    if (/^# (Quality and security checks|Every check runs in Docker|baseline once)/.test(line))
      continue;
    out.push(line);
  }
  return `${out.join("\n").trimEnd()}\n\n${preset}`;
}

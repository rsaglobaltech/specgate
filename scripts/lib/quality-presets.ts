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
  osv: "ghcr.io/google/osv-scanner:v2.2.4",
  node: "node:22",
};

const read = (dir: string, rel: string) => {
  try {
    return fs.readFileSync(path.join(dir, rel), "utf8");
  } catch {
    return "";
  }
};

/** A stack and the folder its build file is in, relative to the root ("" for the root). */
export interface App {
  stack: Stack;
  dir: string;
}

const STACKS: Stack[] = ["maven", "gradle", "node"];
const BUILD_FILES: Record<Stack, string[]> = {
  maven: ["pom.xml"],
  gradle: ["build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"],
  node: ["package.json"],
};
const NOT_APPS = new Set(["node_modules", "target", "build", "dist", "docs", "features", "infra"]);

/** Folders one level down, and in apps/, packages/ and services/: where a monorepo keeps its apps. */
function appFolders(projectDir: string): string[] {
  const children = (rel: string) => {
    try {
      return fs
        .readdirSync(path.join(projectDir, rel), { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !NOT_APPS.has(e.name))
        .map((e) => (rel ? `${rel}/${e.name}` : e.name))
        .sort();
    } catch {
      return [];
    }
  };
  const top = children("");
  const nested = ["apps", "packages", "services"].flatMap((d) =>
    top.includes(d) ? children(d) : []
  );
  return [...top, ...nested];
}

/**
 * Each stack with the folder it is built in (REQ-235). The root wins: a stack
 * whose build file is at the root covers the whole repository (a Maven
 * reactor, npm workspaces); otherwise each folder with that build file is an
 * app of its own, such as forja's `apps/api`.
 */
export function detectApps(projectDir: string): App[] {
  const has = (rel: string) => fs.existsSync(path.join(projectDir, rel));
  const out: App[] = [];
  const folders = appFolders(projectDir);
  for (const stack of STACKS) {
    const at = (dir: string) => BUILD_FILES[stack].some((f) => has(dir ? `${dir}/${f}` : f));
    if (at("")) out.push({ stack, dir: "" });
    else for (const dir of folders) if (at(dir)) out.push({ stack, dir });
  }
  return out;
}

/** The stacks a project's build files give away, in the order presets are written. */
export function detectStacks(projectDir: string): Stack[] {
  return [...new Set(detectApps(projectDir).map((a) => a.stack))];
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
  /** The host's Docker, for tests that start containers (REQ-238). */
  docker?: boolean;
  /** The earlier check whose output it reads (REQ-240). */
  needs?: string;
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
    ...(c.docker ? ["    docker: true"] : []),
    ...(c.needs ? [`    needs: ${c.needs}`] : []),
  ];
  return c.missing ? [`  # ${c.missing}`, ...lines.map((l) => `  #${l.slice(1)}`)] : lines;
}

/**
 * The secrets and dependency checks every stack shares; `depsLock` is from the
 * root, and `generated` when a check before it writes it (Maven's bill of materials).
 */
function shared(
  projectDir: string,
  level: Level,
  depsLock: string,
  generated = false
): PresetCheck[] {
  // osv-scanner reads a lockfile (or pom.xml); without one it finds nothing to
  // scan and writes no SARIF, so the check would fail on every run.
  const lockMissing =
    !generated && !fs.existsSync(path.join(projectDir, depsLock))
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

/** A path of an app, from the root. */
const inApp = (dir: string, rel: string) => (dir ? `${dir}/${rel}` : rel);
/** A command of an app, run in its folder. */
const cdApp = (dir: string, cmd: string) => (dir ? `cd ${dir} && ${cmd}` : cmd);

/** Semgrep's rules for a stack: one scan carries every stack's (REQ-235). */
const SEMGREP_RULES: Record<Stack, string[]> = {
  maven: ["p/java"],
  gradle: ["p/java"],
  node: ["p/typescript", "p/react"],
};

function semgrep(rules: string[]): PresetCheck {
  return {
    name: "semgrep",
    run: `semgrep scan ${rules.map((r) => `--config ${r}`).join(" ")} --sarif --output .specgate/quality/semgrep.sarif --metrics off --quiet`,
    when: "end",
    image: IMAGES.semgrep,
    sarif: ".specgate/quality/semgrep.sarif",
  };
}

/** The project's own group in a pom, its parent's and its dependencies' aside; "" when it names none. */
export function pomGroup(pom: string): string {
  const own = pom.replace(
    /<(parent|dependencies|dependencyManagement|build|profiles|reporting|plugins|pluginRepositories|repositories)\b[\s\S]*?<\/\1>/g,
    ""
  );
  return (/<groupId>\s*([\w.-]+)\s*<\/groupId>/.exec(own) || [])[1] || "";
}

/**
 * Coverage with JaCoCo's agent on the project's classes only (REQ-250). With
 * every class instrumented, Testcontainers' were too: its container stop ran
 * into JaCoCo's dump at shutdown and Surefire killed the JVM after 30 s, on
 * every run of a Spring Boot API (truck-flote, S36).
 */
function jacocoCoverage(mvn: string, group: string): string {
  const report = "org.jacoco:jacoco-maven-plugin:0.8.12:report";
  if (!group) return `${mvn} org.jacoco:jacoco-maven-plugin:0.8.12:prepare-agent test ${report}`;
  const agent =
    "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:copy -Dartifact=org.jacoco:org.jacoco.agent:0.8.12:jar:runtime -DoutputDirectory=target/jacoco-agent -Dmdep.stripVersion=true";
  return `${mvn} ${agent} test ${report} '-DargLine=-javaagent:target/jacoco-agent/org.jacoco.agent-runtime.jar=destfile=target/jacoco.exec,includes=${group}.*'`;
}

function maven(projectDir: string, level: Level, dir = ""): PresetCheck[] {
  const appDir = path.join(projectDir, dir);
  const pom = read(appDir, "pom.xml");
  const image = `maven:3.9-eclipse-temurin-${javaVersion(appDir)}`;
  const m2 = ["specgate-m2:/root/.m2"];
  const mvn = "mvn -B -q";
  // REQ-238: the tests start containers; they need the host's Docker.
  const testcontainers = /org\.testcontainers/.test(pom);
  // REQ-237: Maven resolves what a parent POM or a BOM manages, with its own
  // repositories and cache; osv-scanner then reads that bill of materials.
  const [secrets, dependencies] = shared(projectDir, level, inApp(dir, "target/bom.json"), true);
  const checks: PresetCheck[] = [
    secrets,
    {
      name: "sbom",
      // REQ-276: an application whose pom skips deploy (Quarkus) still has
      // dependencies to scan; CycloneDX otherwise writes nothing for it.
      run: cdApp(
        dir,
        `${mvn} org.cyclonedx:cyclonedx-maven-plugin:2.9.1:makeBom -DoutputFormat=json -DoutputName=bom -Dcyclonedx.skipNotDeployed=false`
      ),
      when: dependencies.when,
      image,
      volumes: m2,
    },
    { ...dependencies, needs: "sbom" },
    {
      name: "coverage",
      run: cdApp(dir, jacocoCoverage(mvn, pomGroup(pom))),
      when: "attempt",
      image,
      volumes: m2,
      report: `jacoco:${inApp(dir, "target/site/jacoco/jacoco.xml")}`,
      timeout: 1800,
      docker: testcontainers,
    },
    {
      name: "spotbugs",
      run: cdApp(
        dir,
        `${mvn} compile com.github.spotbugs:spotbugs-maven-plugin:4.8.6.6:spotbugs -Dspotbugs.sarifOutput=true`
      ),
      when: level === "strict" ? "attempt" : "end",
      image,
      volumes: m2,
      sarif: inApp(dir, "target/spotbugsSarif.json"),
    },
  ];
  if (level === "strict") {
    checks.push(
      {
        name: "pmd",
        run: cdApp(
          dir,
          `${mvn} org.apache.maven.plugins:maven-pmd-plugin:3.26.0:pmd -Dformat=net.sourceforge.pmd.renderers.SarifRenderer -DlinkXRef=false`
        ),
        when: "attempt",
        image,
        volumes: m2,
        sarif: inApp(dir, "target/pmd.sarif.json"),
      },
      semgrep(SEMGREP_RULES.maven),
      {
        name: "mutation",
        run: cdApp(
          dir,
          `${mvn} test-compile org.pitest:pitest-maven:mutationCoverage -DtargetClasses=${dir ? `{changed_classes@${dir}}` : "{changed_classes}"} -DoutputFormats=XML -DtimestampedReports=false`
        ),
        when: "end",
        image,
        volumes: m2,
        report: `pit:${inApp(dir, "target/pit-reports/mutations.xml")}`,
        timeout: 3600,
        docker: testcontainers,
        missing: /pitest-maven/.test(pom)
          ? undefined
          : "Mutation needs pitest-maven with pitest-junit5-plugin declared in pom.xml (JUnit 5 cannot be added from the command line); add them and uncomment:",
      }
    );
  }
  return checks;
}

function gradle(projectDir: string, level: Level, dir = ""): PresetCheck[] {
  const appDir = path.join(projectDir, dir);
  const build = `${read(appDir, "build.gradle")}\n${read(appDir, "build.gradle.kts")}`;
  // osv-scanner reads Gradle's lockfile, not the build script: dependency locking must be on.
  const lock = inApp(dir, "gradle.lockfile");
  const image = `gradle:8-jdk${javaVersion(appDir)}`;
  const cache = ["specgate-gradle:/home/gradle/.gradle"];
  const checks: PresetCheck[] = [
    ...shared(projectDir, level, lock),
    {
      name: "coverage",
      run: cdApp(dir, "gradle --no-daemon -q test jacocoTestReport"),
      when: "attempt",
      image,
      volumes: cache,
      report: `jacoco:${inApp(dir, "build/reports/jacoco/test/jacocoTestReport.xml")}`,
      docker: /org\.testcontainers/.test(build),
      timeout: 1800,
      missing: /\bjacoco\b/.test(build)
        ? undefined
        : "Coverage needs the jacoco plugin applied, with reports { xml.required = true }; add it and uncomment:",
    },
  ];
  if (level === "strict") checks.push(semgrep(SEMGREP_RULES.gradle));
  return checks;
}

function node(projectDir: string, level: Level, dir = ""): PresetCheck[] {
  const appDir = path.join(projectDir, dir);
  let pkg: { devDependencies?: Record<string, string>; dependencies?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(read(appDir, "package.json") || "{}");
  } catch {
    pkg = {};
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const { lock, install } = nodeInstall(appDir);
  const slug =
    path
      .basename(appDir)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project";
  // node_modules lives in a volume: the host's may hold another platform's binaries.
  const volumes = [
    `specgate-nm-${slug}:/src/${inApp(dir, "node_modules")}`,
    "specgate-npm:/root/.npm",
  ];
  const inNode = (cmd: string) => cdApp(dir, `${install} && ${cmd}`);
  const tsconfig = fs.existsSync(path.join(appDir, "tsconfig.json"));
  const runner = deps.vitest ? "vitest" : deps.jest ? "jest" : "";
  const checks: PresetCheck[] = [...shared(projectDir, level, inApp(dir, lock))];
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
    report: `lcov:${inApp(dir, "coverage/lcov.info")}`,
    timeout: 1800,
    missing: runner
      ? runner === "vitest" && !deps["@vitest/coverage-v8"] && !deps["@vitest/coverage-istanbul"]
        ? "Coverage needs @vitest/coverage-v8 in devDependencies; add it and uncomment:"
        : undefined
      : "Coverage needs Vitest or Jest; with one installed, uncomment:",
  });
  if (level === "strict") {
    checks.push(semgrep(SEMGREP_RULES.node), {
      name: "mutation",
      run: inNode(
        `npx --no-install stryker run --mutate ${dir ? `{changed_src@${dir}}` : "{changed_src}"} --reporters json`
      ),
      when: "end",
      image: IMAGES.node,
      volumes,
      report: `stryker:${inApp(dir, "reports/mutation/mutation.json")}`,
      timeout: 3600,
      missing: deps["@stryker-mutator/core"]
        ? undefined
        : "Mutation needs @stryker-mutator/core and its runner in devDependencies; add them and uncomment:",
    });
  }
  return checks;
}

/** The `quality:` block a level writes for a project, as YAML lines. */
export function presetYaml(projectDir: string, level: Level): string {
  const found = detectApps(projectDir);
  const apps: App[] = found.length ? found : [{ stack: "node", dir: "" }];
  // One Semgrep scan of the repository, with the rules of every stack in it.
  const rules = [...new Set(apps.flatMap((a) => SEMGREP_RULES[a.stack]))];
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
  for (const { stack, dir } of apps) {
    const checks =
      stack === "maven"
        ? maven(projectDir, level, dir)
        : stack === "gradle"
          ? gradle(projectDir, level, dir)
          : node(projectDir, level, dir);
    for (const c of checks) {
      // One secrets and one Semgrep scan for the whole repository; per-app
      // checks get the stack's name, then the folder's when a stack repeats.
      if (seen.has(c.name) && (c.name === "secrets" || c.name === "semgrep")) continue;
      let name = c.name;
      if (seen.has(name)) name = `${c.name}-${stack}`;
      if (seen.has(name) && dir) name = `${c.name}-${path.basename(dir)}`;
      seen.add(name);
      let check = c.name === "semgrep" ? { ...semgrep(rules), name } : { ...c, name };
      // A renamed check writes its own report: `osv.sarif` → `dependencies-node.sarif`.
      if (name !== c.name && check.sarif && check.sarif.startsWith(".specgate/quality/")) {
        const own = `.specgate/quality/${name}.sarif`;
        check = { ...check, run: check.run.split(check.sarif).join(own), sarif: own };
      }
      lines.push(...render(check));
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

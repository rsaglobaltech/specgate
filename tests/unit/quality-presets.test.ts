"use strict";

/**
 * REQ-225, REQ-230 — the checks of a level for the project's stack, and the
 * strict Maven preset run for real in Docker.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const FIXTURE = path.join(ROOT_DIR, "tests", "fixtures", "quality-maven");
const NL = String.fromCharCode(10);

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-preset-"));
  madeDirs.push(dir);
  return dir;
}
const w = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_BASE: "main" },
  });
const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
const config = (dir: string) => fs.readFileSync(path.join(dir, "harness.config.yaml"), "utf8");
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });

test("REQ-225 SCN-225a: strict for a Maven project", () => {
  const dir = tmp();
  w(
    dir,
    "pom.xml",
    "<project><properties><maven.compiler.release>17</maven.compiler.release></properties></project>"
  );
  const r = sg(dir, "quality", "init", "--level", "strict", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).quality.checks, [
    "commits",
    "secrets",
    "sbom",
    "dependencies",
    "coverage",
    "spotbugs",
    "pmd",
    "semgrep",
    "review",
  ]);
  const text = config(dir);
  assert.match(text, /^quality: strict$/m);
  assert.match(text, /image: maven:3\.9-eclipse-temurin-17/);
  // Every check that runs a tool runs it in Docker; commits (REQ-234) and the
  // review agent (REQ-227) run no tool.
  const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
  const local = readHarnessConfig(dir)
    .quality.checks.filter((c: { runner: string }) => c.runner !== "docker")
    .map((c: { name: string }) => c.name);
  assert.deepEqual(local, ["commits", "review"], "every check that runs a tool runs in Docker");
  assert.match(text, /# Mutation needs pitest-maven/);
  assert.match(text, /^ {2}# - name: mutation$/m, "mutation is written commented");
});

test("REQ-225 SCN-225b: a Node project with pnpm and Vitest", () => {
  const dir = tmp();
  w(
    dir,
    "package.json",
    JSON.stringify({
      devDependencies: {
        typescript: "5",
        eslint: "9",
        vitest: "2",
        "@vitest/coverage-v8": "2",
      },
    })
  );
  w(dir, "pnpm-lock.yaml", "lockfileVersion: '9.0'" + NL);
  w(dir, "tsconfig.json", "{}");
  const r = sg(dir, "quality", "init", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).quality.checks, [
    "commits",
    "secrets",
    "dependencies",
    "types",
    "lint",
    "coverage",
  ]);
  const text = config(dir);
  assert.match(text, /pnpm install --frozen-lockfile/);
  assert.match(text, /image: node:22/);
  assert.match(text, /report: lcov:coverage\/lcov\.info/);
  assert.match(text, /scan source -L pnpm-lock\.yaml/);
});

test("REQ-225 SCN-225c: the rest of the file is kept, the checks are not replaced unasked", () => {
  const dir = tmp();
  w(dir, "pom.xml", "<project/>");
  w(
    dir,
    "harness.config.yaml",
    [
      "harness_version: 1",
      'test_cmd: "mvn -B test"',
      "checks:",
      "  - name: old",
      '    run: "echo old"',
      "    runner: local",
      "",
    ].join(NL)
  );
  const refused = sg(dir, "quality", "init");
  assert.notEqual(refused.status, 0);
  assert.match(config(dir), /name: old/);
  const forced = sg(dir, "quality", "init", "--force");
  assert.equal(forced.status, 0, forced.stdout + forced.stderr);
  const text = config(dir);
  assert.match(text, /^test_cmd: "mvn -B test"$/m);
  assert.doesNotMatch(text, /name: old/);
  assert.match(text, /name: spotbugs/);
});

// ── REQ-235 ─────────────────────────────────────────────────────────────────

test("REQ-235 SCN-235a: a Spring Boot API in apps/api beside a Node root", () => {
  const dir = tmp();
  w(dir, "package.json", JSON.stringify({ devDependencies: { eslint: "9" } }));
  w(dir, "package-lock.json", "{}");
  w(
    dir,
    "apps/api/pom.xml",
    "<project><properties><java.version>21</java.version></properties></project>"
  );
  w(dir, "apps/web/package.json", "{}");
  const r = sg(dir, "quality", "init", "--level", "strict", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const checks: string[] = json(r).quality.checks;
  for (const name of ["coverage", "spotbugs", "pmd", "lint", "dependencies-node"])
    assert.ok(checks.includes(name), `${name} in ${checks.join(", ")}`);
  assert.equal(checks.filter((c) => c.startsWith("semgrep")).length, 1, "one Semgrep scan");
  const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
  const byName = new Map(
    readHarnessConfig(dir).quality.checks.map((c: { name: string }) => [c.name, c])
  );
  for (const name of ["coverage", "spotbugs", "pmd"]) {
    const c = byName.get(name) as { run: string; image: string };
    assert.match(c.run, /^cd apps\/api && mvn /, `${name}: ${c.run}`);
    assert.equal(c.image, "maven:3.9-eclipse-temurin-21");
  }
  const coverage = byName.get("coverage") as { report: { path: string } };
  assert.equal(coverage.report.path, "apps/api/target/site/jacoco/jacoco.xml");
  const spotbugs = byName.get("spotbugs") as { sarif: string };
  assert.equal(spotbugs.sarif, "apps/api/target/spotbugsSarif.json");
  const semgrep = byName.get("semgrep") as { run: string };
  assert.match(semgrep.run, /--config p\/java/);
  assert.match(semgrep.run, /--config p\/typescript/);
  assert.equal(json(r).quality.stacks.join(","), "maven,node");
  // Two dependency scans, two reports: one must not overwrite the other.
  const deps = ["dependencies", "dependencies-node"].map(
    (n) => byName.get(n) as { run: string; sarif: string }
  );
  assert.notEqual(deps[0].sarif, deps[1].sarif);
  for (const d of deps) assert.ok(d.run.includes(`--output ${d.sarif}`), d.run);
});

test("REQ-235 SCN-235b: the changed files of one folder", () => {
  const { expandRun } = require("../../packages/core/src/domain/QualityChecks");
  const ctx = {
    req: "REQ-001",
    base: "main",
    reportDir: ".specgate/quality",
    changedFiles: ["apps/api/src/main/java/eu/fleet/Truck.java", "apps/web/src/map.ts"],
  };
  assert.equal(expandRun("{changed_classes@apps/api}", ctx), "eu.fleet.Truck");
  assert.equal(expandRun("{changed_src@apps/web}", ctx), "src/map.ts");
  assert.equal(expandRun("{changed_src@apps/api}", ctx), "", "nothing of another folder");
  assert.equal(
    expandRun("{changed_classes}", ctx),
    "eu.fleet.Truck",
    "the plain form is unchanged"
  );
});

// ── REQ-258 ─────────────────────────────────────────────────────────────────

test("REQ-258 SCN-258a: a run after init", () => {
  const dir = tmp();
  w(dir, "package.json", "{}");
  w(dir, ".gitignore", "node_modules/\n");
  assert.equal(sg(dir, "quality", "init").status, 0);
  assert.equal(sg(dir, "quality", "init", "--force").status, 0, "a second init adds nothing");
  const ignore = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
  assert.equal(
    ignore.split("\n").filter((l: string) => l === ".specgate/quality/").length,
    1,
    ignore
  );
  git(dir, "init", "-q");
  w(dir, ".specgate/quality/osv.sarif", "{}");
  w(dir, ".specgate/quality-baseline.json", "{}");
  const status = git(dir, "status", "--porcelain", "--untracked-files=all").stdout;
  assert.doesNotMatch(status, /quality\/osv\.sarif/);
  assert.match(status, /quality-baseline\.json/, "the baseline is to be committed");
});

// ── REQ-250 ─────────────────────────────────────────────────────────────────

test("REQ-250 SCN-250a: a Spring Boot API whose group is eu.truckflote", () => {
  const dir = tmp();
  w(dir, "package.json", "{}");
  w(
    dir,
    "apps/api/pom.xml",
    "<project><parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId></parent><groupId>eu.truckflote</groupId><artifactId>api</artifactId></project>"
  );
  assert.equal(sg(dir, "quality", "init").status, 0);
  const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
  const coverage = readHarnessConfig(dir).quality.checks.find(
    (c: { name: string }) => c.name === "coverage"
  );
  assert.match(
    coverage.run,
    /javaagent:[^ ]*org\.jacoco\.agent-runtime\.jar=destfile=target\/jacoco\.exec,includes=eu\.truckflote\.\*/
  );
  assert.equal(coverage.report.path, "apps/api/target/site/jacoco/jacoco.xml");
  const bare = tmp();
  w(bare, "pom.xml", "<project><artifactId>x</artifactId></project>");
  assert.equal(sg(bare, "quality", "init").status, 0);
  assert.doesNotMatch(config(bare), /includes=/, "no group: every class");
});

// ── REQ-237, REQ-238 ────────────────────────────────────────────────────────

test("REQ-237 SCN-237a: a Spring Boot parent manages the versions", () => {
  const dir = tmp();
  w(
    dir,
    "pom.xml",
    "<project><parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>4.1.1</version></parent></project>"
  );
  const r = sg(dir, "quality", "init", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const checks: string[] = json(r).quality.checks;
  assert.ok(checks.indexOf("sbom") >= 0 && checks.indexOf("sbom") < checks.indexOf("dependencies"));
  const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
  const byName = new Map(
    readHarnessConfig(dir).quality.checks.map((c: { name: string }) => [c.name, c])
  );
  const sbom = byName.get("sbom") as { run: string; image: string; when: string };
  const deps = byName.get("dependencies") as { run: string; image: string; when: string };
  assert.match(sbom.run, /cyclonedx-maven-plugin:[\d.]+:makeBom .*-DoutputName=bom/);
  assert.match(sbom.image, /^maven:/);
  assert.match(deps.run, /-L target\/bom\.json/);
  assert.equal(deps.image, "ghcr.io/google/osv-scanner:v2.2.4");
  assert.equal(sbom.when, deps.when, "the bill of materials is written in the same stage");
  assert.equal(
    (deps as unknown as { needs: string }).needs,
    "sbom",
    "REQ-240: the baseline runs it first"
  );
});

test("REQ-238 SCN-238a: the preset gives Testcontainers its Docker", () => {
  const dir = tmp();
  w(
    dir,
    "pom.xml",
    "<project><dependencies><dependency><groupId>org.testcontainers</groupId><artifactId>postgresql</artifactId></dependency></dependencies></project>"
  );
  assert.equal(sg(dir, "quality", "init", "--level", "strict").status, 0);
  const { readHarnessConfig } = require("../../packages/core/src/infrastructure/HarnessConfigFile");
  const byName = new Map(
    readHarnessConfig(dir).quality.checks.map((c: { name: string }) => [c.name, c])
  );
  assert.equal((byName.get("coverage") as { docker: boolean }).docker, true);
  assert.equal((byName.get("pmd") as { docker: boolean }).docker, false, "PMD starts nothing");
  const plain = tmp();
  w(plain, "pom.xml", "<project/>");
  assert.equal(sg(plain, "quality", "init").status, 0);
  assert.doesNotMatch(config(plain), /docker: true/);
});

// Linux containers only (REQ-254): the check images have no Windows manifest.
const docker =
  String(
    spawnSync("docker", ["version", "--format", "{{.Server.Os}}"], {
      encoding: "utf8",
      timeout: 15000,
    }).stdout || ""
  ).trim() === "linux";

test(
  "REQ-230 SCN-230a: a Maven change judged by the strict preset in Docker",
  { skip: docker ? false : "Docker is not running on this machine", timeout: 1800000 },
  () => {
    const dir = tmp();
    fs.cpSync(path.join(FIXTURE, "src"), path.join(dir, "src"), { recursive: true });
    fs.copyFileSync(path.join(FIXTURE, "pom.xml"), path.join(dir, "pom.xml"));
    w(dir, ".gitignore", ["target/", ".specgate/quality/", ""].join(NL));
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "T");
    assert.equal(sg(dir, "quality", "init", "--level", "strict").status, 0);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "chore: base");
    const base = sg(dir, "quality", "baseline", "--json");
    assert.equal(base.status, 0, base.stdout + base.stderr);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "chore: quality baseline");
    git(dir, "checkout", "-q", "-b", "feature");
    fs.copyFileSync(
      path.join(FIXTURE, "change", "main", "Discount.java"),
      path.join(dir, "src/main/java/com/shop/Discount.java")
    );
    fs.copyFileSync(
      path.join(FIXTURE, "change", "test", "DiscountTest.java"),
      path.join(dir, "src/test/java/com/shop/DiscountTest.java")
    );
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "feat: discounts");

    const r = sg(dir, "quality", "run", "--json");
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    const by = Object.fromEntries(
      json(r).quality.outcomes.map((o: { name: string }) => [o.name, o])
    );
    assert.equal(by.spotbugs.ok, false);
    assert.deepEqual(
      by.spotbugs.findings.fresh.map((f: string) => f.split(" ")[0]),
      ["src/main/java/com/shop/Discount.java:5"]
    );
    assert.ok(by.spotbugs.findings.baselined > 0, "the fixture's own debt is held back");
    assert.equal(by.coverage.ok, false);
    assert.ok(by.coverage.measure.misses.some((m: string) => /Discount\.java:6 /.test(m)));
    assert.equal(by.mutation.ok, false);
    assert.ok(by.mutation.measure.misses.every((m: string) => /Discount\.java/.test(m)));
    assert.equal(by.pmd.ok, true, JSON.stringify(by.pmd));
    assert.equal(by.semgrep.ok, true, JSON.stringify(by.semgrep));
  }
);

/** A fixture as a repository: its base committed on main, its change committed on feature. */
function fixtureRepo(name: string, ignore: string[], change: Array<[string, string]>) {
  const fixture = path.join(ROOT_DIR, "tests", "fixtures", name);
  const dir = tmp();
  fs.cpSync(fixture, dir, {
    recursive: true,
    filter: (src: string) => !src.includes(`${path.sep}change`),
  });
  w(dir, ".gitignore", [...ignore, ".specgate/quality/", ""].join(NL));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  assert.equal(sg(dir, "quality", "init").status, 0);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "chore: base");
  git(dir, "checkout", "-q", "-b", "feature");
  for (const [from, to] of change) {
    fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true });
    fs.copyFileSync(path.join(fixture, "change", from), path.join(dir, to));
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "feat: discounts");
  return dir;
}

function attemptOutcomes(dir: string) {
  const r = sg(dir, "quality", "run", "--stage", "attempt", "--json");
  return Object.fromEntries(
    JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).quality.outcomes.map(
      (o: { name: string }) => [o.name, o]
    )
  );
}

test(
  "REQ-230 SCN-230b: a Gradle change judged by the basic preset in Docker",
  { skip: docker ? false : "Docker is not running on this machine", timeout: 1800000 },
  () => {
    const dir = fixtureRepo(
      "quality-gradle",
      ["build/", ".gradle/"],
      [["main/Discount.java", "src/main/java/com/shop/Discount.java"]]
    );
    const by = attemptOutcomes(dir);
    assert.equal(by.commits.ok, true);
    assert.equal(by.secrets.ok, true, JSON.stringify(by.secrets));
    assert.equal(by.coverage.ok, false, JSON.stringify(by.coverage));
    assert.equal(by.coverage.measure.value, 0);
    assert.ok(
      by.coverage.measure.misses.every((m: string) =>
        m.startsWith("src/main/java/com/shop/Discount.java:")
      )
    );
  }
);

test(
  "REQ-230 SCN-230c: a Node change judged by the basic preset in Docker",
  { skip: docker ? false : "Docker is not running on this machine", timeout: 1800000 },
  () => {
    const dir = fixtureRepo(
      "quality-node",
      ["node_modules/", "coverage/"],
      [["discount.ts", "src/discount.ts"]]
    );
    const by = attemptOutcomes(dir);
    assert.equal(by.types.ok, true, JSON.stringify(by.types));
    assert.equal(by.coverage.ok, false, JSON.stringify(by.coverage));
    assert.ok(by.coverage.measure.misses.some((m: string) => m.startsWith("src/discount.ts:")));
  }
);

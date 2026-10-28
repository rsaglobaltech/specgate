"use strict";

/**
 * REQ-226 — SonarQube Community, run locally in Docker as a check: its
 * issues as SARIF, the scanner's properties, and a real analysis (only with
 * SPECGATE_TEST_SONAR set: the server needs about 2 GB of memory).
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-sonar-"));
  madeDirs.push(dir);
  return dir;
}

const sonar = require("../../scripts/lib/sonar-local");

test("REQ-226 SCN-226a: SonarQube's issues as SARIF", () => {
  const sarif = JSON.parse(
    sonar.issuesToSarif(
      [
        {
          rule: "java:S2095",
          component: "shop:src/main/java/com/shop/Repo.java",
          line: 5,
          severity: "BLOCKER",
          message: "Use try-with-resources",
          hash: "30b42a9b",
        },
        { rule: "java:S1135", component: "shop:pom.xml", severity: "MINOR", message: "TODO" },
      ],
      "shop"
    )
  );
  const [a, b] = sarif.runs[0].results;
  assert.equal(a.level, "error");
  assert.equal(
    a.locations[0].physicalLocation.artifactLocation.uri,
    "src/main/java/com/shop/Repo.java"
  );
  assert.equal(a.locations[0].physicalLocation.region.startLine, 5);
  assert.deepEqual(a.partialFingerprints, { sonarLineHash: "30b42a9b" });
  assert.equal(b.level, "note");
  assert.equal(b.partialFingerprints, undefined);
  const { readSarif } = require("../../packages/core/src/domain/Sarif");
  const findings = readSarif(JSON.stringify(sarif), "/x", () => null);
  assert.equal(
    findings[0].fingerprint,
    "java:S2095|src/main/java/com/shop/Repo.java|sonarLineHash=30b42a9b"
  );
});

test("REQ-226 SCN-226b: what the scanner is told", () => {
  const java = tmp();
  for (const d of ["src/main/java", "src/test/java", "target/classes"])
    fs.mkdirSync(path.join(java, d), { recursive: true });
  const props = sonar.scannerProperties(java, "shop");
  assert.ok(props.includes("-Dsonar.projectKey=shop"));
  assert.ok(props.includes("-Dsonar.sources=src/main/java"));
  assert.ok(props.includes("-Dsonar.tests=src/test/java"));
  assert.ok(props.includes("-Dsonar.java.binaries=target/classes"));
  const node = tmp();
  const nodeProps = sonar.scannerProperties(node, "web");
  assert.ok(nodeProps.includes("-Dsonar.sources=."));
  const excl = nodeProps.find((p: string) => p.startsWith("-Dsonar.exclusions="));
  for (const x of ["node_modules", "dist", "coverage", ".specgate"]) assert.ok(excl.includes(x), x);
  // The built-in needs no image, and the strict preset lists it commented.
  const { readQuality } = require("../../packages/core/src/domain/QualityChecks");
  assert.deepEqual(
    readQuality({ checks: [{ name: "sonar", run: "builtin:sonar", runner: "docker" }] }).errors,
    []
  );
  const { presetYaml } = require("../../scripts/lib/quality-presets");
  fs.writeFileSync(path.join(java, "pom.xml"), "<project/>");
  const strict = presetYaml(java, "strict");
  assert.match(strict, /# {3}run: "builtin:sonar"/);
  assert.match(strict, /about 2 GB/);
  assert.doesNotMatch(presetYaml(java, "basic"), /builtin:sonar/);
});

const wanted = process.env.SPECGATE_TEST_SONAR === "1";
const docker =
  wanted &&
  spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    timeout: 15000,
  }).status === 0;

test(
  "REQ-226 SCN-226c: a real analysis judged against the baseline",
  {
    skip: !wanted
      ? "set SPECGATE_TEST_SONAR=1 to start SonarQube (about 2 GB) and run it"
      : docker
        ? false
        : "Docker is not running on this machine",
    timeout: 1800000,
  },
  () => {
    const dir = tmp();
    fs.cpSync(path.join(FIXTURE, "src"), path.join(dir, "src"), { recursive: true });
    fs.copyFileSync(path.join(FIXTURE, "pom.xml"), path.join(dir, "pom.xml"));
    fs.writeFileSync(path.join(dir, ".gitignore"), ["target/", ".specgate/quality/", ""].join(NL));
    fs.writeFileSync(
      path.join(dir, "harness.config.yaml"),
      [
        "harness_version: 1",
        "checks:",
        "  - name: compile",
        '    run: "mvn -B -q compile"',
        "    runner: docker",
        "    image: maven:3.9-eclipse-temurin-21",
        "    volumes: [specgate-m2:/root/.m2]",
        "  - name: sonar",
        '    run: "builtin:sonar"',
        "    when: end",
        "    runner: docker",
        "    sarif: .specgate/quality/sonar.sarif",
        "",
      ].join(NL)
    );
    const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "T");
    const sg = (...args: string[]) =>
      spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1", SPECGATE_BASE: "main" },
      });
    assert.equal(sg("quality", "run", "--stage", "attempt").status, 0, "compiled");
    const base = sg("quality", "baseline", "--json");
    assert.equal(base.status, 0, base.stdout + base.stderr);
    git("add", "-A");
    git("commit", "-q", "-m", "chore: base");
    git("checkout", "-q", "-b", "feature");
    fs.copyFileSync(
      path.join(FIXTURE, "change", "main", "Discount.java"),
      path.join(dir, "src/main/java/com/shop/Discount.java")
    );
    git("add", "-A");
    git("commit", "-q", "-m", "feat: discounts");
    sg("quality", "run", "--stage", "attempt");
    const r = sg("quality", "run", "--stage", "end", "--json");
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    const o = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).quality.outcomes.find(
      (x: { name: string }) => x.name === "sonar"
    );
    assert.ok(o.findings, JSON.stringify(o));
    assert.deepEqual(
      o.findings.fresh.map((f: string) => f.split(" ")[0]),
      ["src/main/java/com/shop/Discount.java:5"]
    );
    assert.ok(o.findings.baselined > 0);
    // Without SONAR_TOKEN the token was created with the default login and kept, ignored by git.
    if (!process.env.SONAR_TOKEN) {
      assert.ok(fs.existsSync(path.join(dir, ".specgate", "sonar.local")));
      assert.match(
        fs.readFileSync(path.join(dir, ".gitignore"), "utf8"),
        /\.specgate\/sonar\.local/
      );
    }
  }
);

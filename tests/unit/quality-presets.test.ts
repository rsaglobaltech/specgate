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
    "secrets",
    "dependencies",
    "coverage",
    "spotbugs",
    "pmd",
    "semgrep",
  ]);
  const text = config(dir);
  assert.match(text, /^quality: strict$/m);
  assert.match(text, /image: maven:3\.9-eclipse-temurin-17/);
  assert.ok(!/^\s+runner: (local|auto)/m.test(text), "every check runs in Docker");
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

const docker =
  spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    timeout: 15000,
  }).status === 0;

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

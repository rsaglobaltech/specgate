"use strict";

/**
 * REQ-223, REQ-224 — diff coverage and mutation score over the lines a
 * change touched, read from the reports the project's tools write.
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
const NL = String.fromCharCode(10);

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const measures = require("../../packages/core/src/domain/ChangeMeasures");

const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });

/**
 * A repository whose base commit holds `file` with `before` lines; the
 * working tree then has `after`. The check copies `report` into place, the
 * way a coverage or mutation tool would write it.
 */
function changed(file: string, before: string[], after: string[], report: string, check: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-measure-"));
  madeDirs.push(dir);
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w("spec.md", "# Spec" + NL);
  w(file, before.join(NL) + NL);
  w("report.src", report);
  // The "tool": copies the report into place. A script, so the command has
  // nothing a shell would read — cmd.exe and sh disagree on parentheses.
  w(
    "copy.js",
    [
      'const fs = require("fs");',
      'const path = require("path");',
      "fs.mkdirSync(path.dirname(process.argv[2]), { recursive: true });",
      'fs.copyFileSync("report.src", process.argv[2]);',
    ].join(NL)
  );
  w("harness.config.yaml", ["harness_version: 1", check, ""].join(NL));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  git(dir, "checkout", "-q", "-b", "feature");
  w(file, after.join(NL) + NL);
  return dir;
}

const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_BASE: "main" },
  });
const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));

const copyCheck = (target: string, format: string, threshold: string) =>
  [
    threshold,
    "checks:",
    "  - name: measure",
    `    run: "node copy.js ${target}"`,
    "    runner: local",
    `    report: ${format}:${target}`,
  ].join(NL);

test("REQ-223 SCN-223a: below the threshold, the uncovered lines are named", () => {
  const lcov = [
    "SF:src/a.js",
    "DA:1,1",
    "DA:2,1",
    "DA:3,1",
    "DA:4,0",
    "DA:5,0",
    "DA:6,1",
    "end_of_record",
  ].join(NL);
  const dir = changed(
    "src/a.js",
    ["const a = 1;"],
    ["const a = 1;", "f(1);", "f(2);", "f(3);", "f(4);", "// end"],
    lcov,
    copyCheck("coverage/lcov.info", "lcov", "diff_coverage: 80")
  );
  const r = sg(dir, "quality", "run", "--json");
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  const m = json(r).quality.outcomes[0].measure;
  assert.equal(m.kind, "coverage");
  assert.equal(m.value, 60, "3 of the 5 changed executable lines (2..6)");
  assert.deepEqual(m.misses, ["src/a.js:4 not run by any test", "src/a.js:5 not run by any test"]);
});

test("REQ-223 SCN-223b: JaCoCo's package paths match the repository's", () => {
  const jacoco =
    '<report name="x"><package name="com/shop"><sourcefile name="Order.java">' +
    '<line nr="2" mi="0" ci="3"/><line nr="3" mi="0" ci="1"/><line nr="9" mi="2" ci="0"/>' +
    "</sourcefile></package></report>";
  const dir = changed(
    "src/main/java/com/shop/Order.java",
    ["class Order {", "}"],
    ["class Order {", "  int a = 1;", "  int b = 2;", "}"],
    jacoco,
    copyCheck("target/site/jacoco/jacoco.xml", "jacoco", "diff_coverage: 80")
  );
  const r = sg(dir, "quality", "run", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(json(r).quality.outcomes[0].measure.value, 100);
});

test("REQ-224 SCN-224a: a survivor on a changed line fails it", () => {
  const pit = [
    "<mutations>",
    '<mutation detected="true" status="KILLED"><sourceFile>Order.java</sourceFile><mutatedClass>com.shop.Order</mutatedClass><lineNumber>10</lineNumber><mutator>org.pitest.mutationtest.engine.gregor.mutators.MathMutator</mutator><description>Replaced integer addition with subtraction</description></mutation>',
    '<mutation detected="false" status="SURVIVED"><sourceFile>Order.java</sourceFile><mutatedClass>com.shop.Order$Inner</mutatedClass><lineNumber>11</lineNumber><mutator>org.pitest.mutationtest.engine.gregor.mutators.ConditionalsBoundaryMutator</mutator><description>changed conditional boundary</description></mutation>',
    '<mutation detected="false" status="SURVIVED"><sourceFile>Order.java</sourceFile><mutatedClass>com.shop.Order</mutatedClass><lineNumber>30</lineNumber><mutator>x.VoidMethodCallMutator</mutator><description>removed call</description></mutation>',
    "</mutations>",
  ].join(NL);
  const before = Array.from({ length: 31 }, (_, i) => `// line ${i + 1}`);
  const after = before.map((l, i) => (i === 9 || i === 10 ? `${l} changed` : l));
  const dir = changed(
    "src/main/java/com/shop/Order.java",
    before,
    after,
    pit,
    copyCheck("target/pit-reports/mutations.xml", "pit", "mutation_score: 70")
  );
  const r = sg(dir, "quality", "run", "--json");
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  const m = json(r).quality.outcomes[0].measure;
  assert.equal(m.kind, "mutation");
  assert.equal(m.value, 50);
  assert.equal(m.misses.length, 1);
  assert.match(m.misses[0], /Order\.java:11 ConditionalsBoundaryMutator survived/);
});

test("REQ-224 SCN-224b: Stryker's statuses", () => {
  const report = JSON.stringify({
    files: {
      "src/a.ts": {
        mutants: [
          { status: "Killed", mutatorName: "A", location: { start: { line: 2 } } },
          { status: "Timeout", mutatorName: "B", location: { start: { line: 2 } } },
          {
            status: "Survived",
            mutatorName: "C",
            replacement: "true",
            location: { start: { line: 3 } },
          },
          { status: "Ignored", mutatorName: "D", location: { start: { line: 3 } } },
        ],
      },
    },
  });
  const changedMap = new Map([["src/a.ts", new Set([2, 3])]]);
  const m = measures.mutationScore(changedMap, measures.readStryker(report));
  assert.equal(m.total, 3);
  assert.equal(m.passed, 2);
  assert.deepEqual(m.misses, ["src/a.ts:3 C survived — replaced with true"]);
});

test("REQ-223: the changed lines come from git diff --unified=0", () => {
  const diff = [
    "diff --git a/src/a.js b/src/a.js",
    "--- a/src/a.js",
    "+++ b/src/a.js",
    "@@ -1,0 +2,3 @@",
    "+x",
    "@@ -9 +12 @@",
    "+y",
    "diff --git a/gone.js b/gone.js",
    "--- a/gone.js",
    "+++ /dev/null",
  ].join(NL);
  const map = measures.changedLines(diff);
  assert.deepEqual([...map.get("src/a.js")], [2, 3, 4, 12]);
  assert.equal(map.has("gone.js"), false);
});

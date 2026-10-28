"use strict";

/**
 * REQ-222 — SARIF findings judged against a baseline: only what a change
 * adds fails the gate, and moved code is not new code.
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

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs)
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/**
 * A fake scanner: reports a finding on every line of src/a.js that says
 * "eval(", as a SARIF file, the way a real tool would.
 */
const SCANNER = `
const fs = require("fs");
const lines = fs.readFileSync("src/a.js", "utf8").split(String.fromCharCode(10));
const results = [];
lines.forEach((l, i) => {
  if (l.includes("eval(")) results.push({
    ruleId: "no-eval",
    level: "error",
    message: { text: "eval is dangerous" },
    locations: [{ physicalLocation: { artifactLocation: { uri: "src/a.js" }, region: { startLine: i + 1 } } }],
  });
});
fs.mkdirSync(".specgate/quality", { recursive: true });
fs.writeFileSync(".specgate/quality/scan.sarif", JSON.stringify({ version: "2.1.0", runs: [{ results }] }));
process.exit(results.length ? 1 : 0);
`;

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-baseline-"));
  madeDirs.push(dir);
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  fs.writeFileSync(path.join(dir, "scan.js"), SCANNER);
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src/a.js"), "const a = 1;\neval(input);\nconst b = 2;\n");
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    [
      "harness_version: 1",
      "checks:",
      "  - name: scan",
      '    run: "node scan.js"',
      "    runner: local",
      "    sarif: .specgate/quality/scan.sarif",
      "    scope: all",
      "",
    ].join("\n")
  );
  return dir;
}

const sg = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));

test("REQ-222 SCN-222a: debt in the baseline passes, a new finding fails", () => {
  const dir = project();
  const before = sg(dir, "quality", "run", "--json");
  assert.notEqual(before.status, 0, "without a baseline the existing finding fails");
  const taken = sg(dir, "quality", "baseline", "--json");
  assert.equal(taken.status, 0, taken.stdout + taken.stderr);
  assert.equal(json(taken).quality.checks[0].findings, 1);
  assert.ok(fs.existsSync(path.join(dir, ".specgate/quality-baseline.json")));

  const clean = sg(dir, "quality", "run", "--json");
  assert.equal(clean.status, 0, "the baselined finding no longer fails, though the tool exits 1");

  fs.writeFileSync(
    path.join(dir, "src/a.js"),
    "const a = 1;\neval(input);\nconst b = 2;\nconst c = 3;\neval(other);\n"
  );
  const fresh = sg(dir, "quality", "run", "--json");
  assert.notEqual(fresh.status, 0);
  const o = json(fresh).quality.outcomes[0];
  assert.equal(o.findings.freshCount, 1);
  assert.equal(o.findings.baselined, 1);
  assert.deepEqual(o.findings.fresh, ["src/a.js:5 [no-eval] eval is dangerous"]);
});

test("REQ-222 SCN-222b: moved code is not new code", () => {
  const dir = project();
  assert.equal(sg(dir, "quality", "baseline").status, 0);
  fs.writeFileSync(
    path.join(dir, "src/a.js"),
    "// a header\n// added above\nconst a = 1;\neval(input);\nconst b = 2;\n"
  );
  const r = sg(dir, "quality", "run", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

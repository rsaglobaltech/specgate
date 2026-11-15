"use strict";

/**
 * REQ-563, REQ-564, REQ-565 — what a tool built on the CLI reads, made
 * answerable without guessing (change contract-fixes; found by auditing
 * specgate-studio against the 1.0 line).
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
const { nextStep } = require("../../scripts/cli/commands/spec/StatusCommand");

const made: string[] = [];
require("node:test").after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});
const sg = (dir: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
};
function project(): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-contract-"));
  made.push(parent);
  const r = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return path.join(parent, fs.readdirSync(parent)[0]);
}

test("REQ-563 SCN-563a: a harness config that cannot be read is a finding", () => {
  const dir = project();
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    "harness_version: 1\ntest_cmd: npm test\nroles: [tester, implementer]\n"
  );
  const r = sg(dir, "config", "list", "--json");
  assert.equal(r.status, 1, r.out);
  const doc = JSON.parse(r.stdout);
  const f = doc.status.find((d: { code: string }) => d.code === "harness_config_invalid");
  assert.ok(f, r.out);
  assert.equal(f.file, "harness.config.yaml");
  assert.match(f.fix, /lanes: \[tester, implementer\]/);
  // A readable file is no finding.
  fs.writeFileSync(
    path.join(dir, "harness.config.yaml"),
    "harness_version: 1\ntest_cmd: npm test\n"
  );
  const ok = sg(dir, "config", "list", "--json");
  assert.equal(ok.status, 0, ok.out);
  assert.equal(JSON.parse(ok.stdout).config.test_cmd, "npm test");
});

test("REQ-564 SCN-564a: change show says whether the change may be built", () => {
  const dir = project();
  assert.equal(sg(dir, "propose", "pdf-invoices").status, 0);
  const r = sg(dir, "change", "show", "pdf-invoices", "--json");
  assert.equal(r.status, 0, r.out);
  const a = JSON.parse(r.stdout).change.approvals;
  assert.equal(typeof a.required, "boolean");
  assert.equal(a.approved, false);
  assert.deepEqual(
    a.layers.map((l: { layer: string }) => l.layer),
    ["discover", "design", "tasks"]
  );
});

test("REQ-565 SCN-565a: the next step as data", () => {
  assert.deepEqual(nextStep("specgate apply REQ-007"), {
    command: "specgate apply REQ-007",
    argv: ["apply", "REQ-007"],
    placeholder: false,
  });
  assert.deepEqual(nextStep('specgate new "<a behaviour you rely on>"'), {
    command: 'specgate new "<a behaviour you rely on>"',
    argv: ["new", "<a behaviour you rely on>"],
    placeholder: true,
  });
  assert.deepEqual(nextStep("fill in the brief, then draft"), {
    command: "fill in the brief, then draft",
    argv: null,
    placeholder: false,
  });
  const dir = project();
  const doc = JSON.parse(sg(dir, "status", "--json").stdout);
  assert.equal(doc.next.command, doc.nextCommand);
});

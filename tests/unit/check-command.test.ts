"use strict";

/**
 * `specgate check` — the gate under one name (phase 1 of
 * mejoras/plan-simplificacion-equipo.md).
 *
 * The team found the tool hard to absorb, and the gate was a fair example:
 * `validate` with a choice of five `--strict-*` flags, and the suite run by a
 * different command. `check` is `validate --strict` then the project's tests,
 * and it says so when it could not run the tests rather than reporting a pass
 * it did not earn.
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
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8" });
}

/** A freshly adopted repository: its own gate passes. */
function adopted() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-check-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"d","version":"1.0.0","scripts":{"test":"node -e \\"\\""}}'
  );
  fs.writeFileSync(path.join(dir, "lib/index.js"), "module.exports = {};\n");
  const r = cli("adopt", "--project-dir", dir, "--no-capabilities");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, dir };
}

function json(r) {
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
}

test("check passes and says it did not run the tests when none are configured", () => {
  const { parent, dir } = adopted();
  try {
    const r = cli("check", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Gate passed/);
    assert.match(r.stdout, /checked the specification, not the code/);

    const doc = json(cli("check", dir, "--json"));
    assert.equal(doc.check.validate, "passed");
    assert.equal(doc.check.tests, "not_configured");
    assert.deepEqual(
      doc.status.map((d) => d.code),
      ["tests_not_configured"]
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("check runs the test command and fails when it fails", () => {
  const { parent, dir } = adopted();
  try {
    const r = cli("check", dir, "--json", "--test-cmd", 'node -e "process.exit(3)"');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const doc = json(r);
    assert.equal(doc.check, null);
    assert.equal(doc.status[0].code, "check_tests_failed");

    const ok = cli("check", dir, "--test-cmd", 'node -e ""');
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.doesNotMatch(ok.stdout, /checked the specification, not the code/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("check reads test_cmd from harness.config.yaml", () => {
  const { parent, dir } = adopted();
  try {
    // A script, not `node -e "…"` inside YAML: nested quotes survive sh and
    // die in cmd.exe, and the test then measures quoting, not `check`.
    fs.writeFileSync(path.join(dir, "fail.js"), "process.exit(4);\n");
    fs.writeFileSync(path.join(dir, "harness.config.yaml"), 'test_cmd: "node fail.js"\n');
    const r = cli("check", dir, "--json");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(json(r).status[0].code, "check_tests_failed");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("check is the strong gate, not a subset of it", () => {
  // A delivered requirement whose test file is gone: `--strict-tdd` alone
  // passes this, and that is what ten pages used to recommend.
  const { parent, dir } = adopted();
  try {
    const add = cli("req", "add", "Totals are rounded half-up", "--project-dir", dir);
    const reqId = /Added (REQ-\d+)/.exec(add.stdout)[1];
    cli(
      "req",
      "link",
      reqId,
      "--feature",
      "features/adoption/baseline.feature",
      "--test",
      "test/totals.test.js",
      "--project-dir",
      dir
    );
    assert.equal(cli("done", reqId, "--project-dir", dir).status, 0);
    const r = cli("check", dir, "--json", "--test-cmd", 'node -e ""');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(json(r).status[0].code, "check_validate_failed");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("check --help is not a usage error, and an unknown flag is", () => {
  const help = cli("check", "--help");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /validate --strict/);
  assert.equal(cli("check", "--strict-tdd").status, 2);
});

test("req link refuses --status instead of dropping it", () => {
  // It printed a tick and left the row Draft — found writing the test above.
  const { parent, dir } = adopted();
  try {
    const add = cli("req", "add", "Totals are rounded half-up", "--project-dir", dir);
    const reqId = /Added (REQ-\d+)/.exec(add.stdout)[1];
    const r = cli(
      "req",
      "link",
      reqId,
      "--test",
      "t.js",
      "--status",
      "Implemented",
      "--project-dir",
      dir
    );
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, new RegExp(`specgate done ${reqId} --status Implemented`));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

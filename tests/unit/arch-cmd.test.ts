"use strict";

/**
 * `arch_cmd` — the team's architecture check in the gate (ADR-0028, phase 1).
 *
 * The gate proved that a requirement has a scenario and a test, and said
 * nothing about where the code went. `arch_cmd` runs the project's own
 * architecture tool (ArchUnit, dependency-cruiser, …) between validation and
 * the tests, in `check`, `done` and the harness gate.
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
const { planGateCheck, planDoneVerification } = require(
  path.join(ROOT_DIR, "dist/packages/core/src/domain/DoneVerification")
);

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8" });
}

function adopted() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-arch-"));
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

test("the architecture runs between validation and the tests", () => {
  const plan = planGateCheck("/p", "npm test", "npm run arch");
  assert.deepEqual(
    plan.steps.map((s) => s.stage),
    ["validate", "arch", "tests"]
  );
  assert.deepEqual(
    planGateCheck("/p", "npm test", "  ").steps.map((s) => s.stage),
    ["validate", "tests"]
  );
  const done = planDoneVerification("/p", {
    check: true,
    strict: true,
    reqId: "REQ-001",
    testCmd: "npm test",
    archCmd: "npm run arch",
  });
  assert.deepEqual(
    done.steps.map((s) => s.stage),
    ["validate", "arch", "tests"]
  );
});

test("config set arch_cmd keeps it beside test_cmd, and check runs it", () => {
  const { parent, dir } = adopted();
  try {
    const set = cli("config", "set", "arch_cmd", 'node -e ""', "--project-dir", dir);
    assert.equal(set.status, 0, set.stdout + set.stderr);
    cli("config", "set", "test_cmd", 'node -e ""', "--project-dir", dir);
    const yaml = fs.readFileSync(path.join(dir, "harness.config.yaml"), "utf8");
    assert.match(yaml, /^arch_cmd: 'node -e ""'$/m);
    assert.match(yaml, /^test_cmd: 'node -e ""'$/m);

    const r = cli("check", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Architecture/);
    assert.match(r.stdout, /the specification, the architecture and/);

    const doc = json(cli("check", dir, "--json"));
    assert.equal(doc.check.architecture, "passed");
    assert.equal(doc.check.archCommand, 'node -e ""');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a failing architecture check fails the gate before the tests run", () => {
  const { parent, dir } = adopted();
  try {
    const marker = path.join(dir, "tests-ran");
    cli("config", "set", "arch_cmd", 'node -e "process.exit(1)"', "--project-dir", dir);
    cli(
      "config",
      "set",
      "test_cmd",
      `node -e "require('fs').writeFileSync('${marker.replace(/\\/g, "/")}', '')"`,
      "--project-dir",
      dir
    );
    const r = cli("check", dir, "--json");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(json(r).status[0].code, "check_arch_failed");
    assert.equal(fs.existsSync(marker), false, "the tests ran after the architecture failed");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("without arch_cmd the gate passes and says the architecture was not checked", () => {
  const { parent, dir } = adopted();
  try {
    const r = cli("check", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Architecture\s+not checked/);
    assert.equal(json(cli("check", dir, "--json")).check.architecture, "not_configured");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("config get and list show arch_cmd", () => {
  const { parent, dir } = adopted();
  try {
    cli("config", "set", "arch_cmd", "npm run arch", "--project-dir", dir);
    const got = json(cli("config", "get", "arch_cmd", "--project-dir", dir, "--json"));
    assert.equal(got.config.arch_cmd, "npm run arch");
    const list = json(cli("config", "list", "--project-dir", dir, "--json"));
    assert.equal(list.config.arch_cmd, "npm run arch");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

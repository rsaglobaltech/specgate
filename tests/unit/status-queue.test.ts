"use strict";

/**
 * `status` lists the queue itself (phase 1 of mejoras/plan-simplificacion-equipo.md).
 *
 * It used to print counts and answer "Next: specgate plan" — a second command
 * to find out what the first one meant. Now it names each requirement, what it
 * still needs, and a next command with a requirement id in it.
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

function adopted() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-status-"));
  const dir = path.join(parent, "app");
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"d","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, "lib/index.js"), "module.exports = {};\n");
  const r = cli("adopt", "--project-dir", dir, "--no-capabilities");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, dir };
}

test("status names each requirement and what it still needs", () => {
  const { parent, dir } = adopted();
  try {
    cli("new", "Totals are rounded half-up", "--project-dir", dir);
    const out = cli("status", "--project-dir", dir).stdout;
    assert.match(out, /REQ-002\s+Totals are rounded half-up\s+a test and code/);
    assert.match(out, /To do/);
    assert.doesNotMatch(out, /Next\s+specgate plan/, "status must not send you to plan");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a requirement whose test exists is next, by id, through the gate", () => {
  const { parent, dir } = adopted();
  try {
    cli("new", "Totals are rounded half-up", "--project-dir", dir);
    fs.mkdirSync(path.join(dir, "test"), { recursive: true });
    fs.writeFileSync(path.join(dir, "test/totals.test.js"), "// REQ-002\n");
    cli("req", "link", "REQ-002", "--test", "test/totals.test.js", "--project-dir", dir);

    const out = cli("status", "--project-dir", dir).stdout;
    assert.match(out, /Ready to close/);
    assert.match(out, /Next\s+specgate done REQ-002 --strict/);

    const doc = JSON.parse(cli("status", "--project-dir", dir, "--json").stdout);
    assert.equal(doc.nextCommand, "specgate done REQ-002 --strict");
    const req = doc.requirements.find((r) => r.id === "REQ-002");
    assert.equal(req.title, "Totals are rounded half-up");
    assert.equal(req.category, "NEEDS_STATUS_UPDATE");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a long queue is capped, and says where the rest is", () => {
  const { parent, dir } = adopted();
  try {
    for (let i = 0; i < 14; i++) cli("new", `Requirement number ${i} holds`, "--project-dir", dir);
    const out = cli("status", "--project-dir", dir).stdout;
    assert.match(out, /… \d+ more — specgate plan lists them all/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

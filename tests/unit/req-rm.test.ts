"use strict";

/**
 * Fase 4.1 — `req add` had no counterpart.
 *
 * Two of three cold adoptions repaired a corrupted matrix by hand with a
 * script, because nothing supported taking a requirement back out. The defect
 * that put them there is fixed; the gap was not, and a matrix a team cannot
 * delete a row from is not a document a team can maintain.
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

function scaffold() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "csda-rm-"));
  const r = cli("init", "--yes", "--out", parent, "--no-git");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { parent, dir: path.join(parent, "my-spec-driven-app") };
}

function matrixRows(dir) {
  return fs
    .readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8")
    .split("\n")
    .filter((l) => /^\|\s*REQ-/.test(l.trim()));
}

test("rm takes the row and the prose, and the project still validates", () => {
  const { parent, dir } = scaffold();
  try {
    const added = cli("req", "add", "Totals are rounded half-up", "--project-dir", dir);
    const reqId = /Added (REQ-\d+)/.exec(added.stdout)[1];
    assert.equal(
      matrixRows(dir).some((l) => l.includes(reqId)),
      true
    );

    const r = cli("req", "rm", reqId, "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(
      matrixRows(dir).some((l) => l.includes(reqId)),
      false
    );
    assert.ok(!fs.readFileSync(path.join(dir, "spec.md"), "utf8").includes(reqId));

    assert.equal(cli("validate", dir, "--strict-tdd").status, 0);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("--dry-run writes nothing", () => {
  const { parent, dir } = scaffold();
  try {
    const before = fs.readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8");
    const r = cli("req", "rm", "REQ-000", "--dry-run", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /dry-run/);
    assert.equal(fs.readFileSync(path.join(dir, "docs/specs/traceability.md"), "utf8"), before);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a delivered requirement is refused without --force", () => {
  // Removing it deletes the record that something shipped. That is a decision,
  // not a typo fix.
  const { parent, dir } = scaffold();
  try {
    // REQ-000 has no test; the point here is the status, not the gate.
    assert.equal(
      cli("done", "REQ-000", "--status", "Verified", "--no-check", "--project-dir", dir).status,
      0
    );

    const refused = cli("req", "rm", "REQ-000", "--project-dir", dir);
    assert.equal(refused.status, 1, refused.stdout + refused.stderr);
    assert.match(refused.stderr, /not Draft/);
    assert.match(refused.stderr, /Deprecated/, "the non-destructive alternative must be offered");
    assert.equal(
      matrixRows(dir).some((l) => l.includes("REQ-000")),
      true,
      "nothing was removed"
    );

    const forced = cli("req", "rm", "REQ-000", "--force", "--project-dir", dir);
    assert.equal(forced.status, 0, forced.stdout + forced.stderr);
    assert.equal(
      matrixRows(dir).some((l) => l.includes("REQ-000")),
      false
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a feature file left with no row is reported, not silently orphaned", () => {
  // `validate` fails on a feature file that is not in the matrix. Learning that
  // from a red build instead of from here would waste somebody's afternoon.
  const { parent, dir } = scaffold();
  try {
    const r = cli("req", "rm", "REQ-000", "--force", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /health\.feature is no longer referenced/);
    assert.match(r.stdout, /validate.*fails/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("rm says what it did not touch", () => {
  const { parent, dir } = scaffold();
  try {
    const r = cli("req", "rm", "REQ-000", "--force", "--project-dir", dir);
    assert.match(r.stdout, /Nothing else was touched/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("an id that is not there is an error, not a silent success", () => {
  const { parent, dir } = scaffold();
  try {
    const r = cli("req", "rm", "REQ-999", "--project-dir", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /REQ-999/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("rm needs an id", () => {
  const { parent, dir } = scaffold();
  try {
    const r = cli("req", "rm", "--project-dir", dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /REQ-id/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

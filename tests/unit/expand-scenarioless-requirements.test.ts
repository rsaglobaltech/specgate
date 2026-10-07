"use strict";

/**
 * A requirement a pack declares without a scenario still gets a matrix row.
 *
 * Rows were written per scenario, so the multi-tenant pack's REQ-004 — a use
 * case, no scenario — never reached the matrix, and `validate --against-lock`
 * failed a freshly installed pack with `pack_requirement_missing`. The fix it
 * suggested, `specops sync`, re-expanded the same matrix. Found by the E2E
 * packs journey.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const cli = (cwd, ...args) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });

test("a freshly installed pack passes validate --against-lock", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "expand-scenarioless-"));
  try {
    assert.equal(
      cli(parent, "init", "--yes", "--no-git", "--no-sample-req", "--out", ".").status,
      0
    );
    const project = path.join(parent, fs.readdirSync(parent)[0]);
    const add = cli(
      project,
      "specops",
      "add",
      "--pack-root",
      path.join(ROOT_DIR, "packs"),
      "--pack",
      "multi-tenant/backend",
      "--var",
      "PROJECT_NAME=Shop",
      "--var",
      "PROJECT_SLUG=shop",
      "--var",
      "DOMAIN=retail"
    );
    assert.equal(add.status, 0, add.stdout + add.stderr);

    const matrix = fs.readFileSync(path.join(project, "docs/specs/traceability.md"), "utf8");
    const row = matrix.split("\n").find((l) => l.startsWith("| REQ-004 |"));
    assert.ok(row, "REQ-004 has a row");
    assert.match(row, /\| REQ-004 \| - \| - \| UC-004/);
    assert.match(row, /\| Draft \|$/);

    const v = cli(project, "validate", ".", "--against-lock");
    assert.equal(v.status, 0, v.stdout + v.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

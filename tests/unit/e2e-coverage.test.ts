"use strict";

/**
 * Every command the CLI exposes has an end-to-end journey, or is listed in
 * e2e/uncovered.json — a list that can only shrink.
 *
 * Runs `node e2e/run.mjs --coverage`, which reads the journey declarations and
 * the command surface without packing anything, so it costs a second here and
 * makes adding a command without a journey (or covering one without removing
 * it from the list) fail where everybody looks first.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);

test("every command has an E2E journey or is listed as not covered yet", () => {
  const r = spawnSync(process.execPath, [path.join(ROOT_DIR, "e2e", "run.mjs"), "--coverage"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /E2E coverage: \d+\/\d+ commands/);
});

"use strict";

/**
 * REQ-570 — every released version's project keeps working: a project as each
 * release wrote it is kept under tests/compat/<version>/, and the CLI being
 * built reads it, migrates it when it is older than 1.0, and finds it sound
 * (change compat-fixtures).
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
const COMPAT = path.join(ROOT_DIR, "tests", "compat");

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
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });

/** A committed copy of the fixture, so migrate's dirty-tree check passes. */
function copyOf(version: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `specgate-compat-${version}-`));
  made.push(dir);
  fs.cpSync(path.join(COMPAT, version), dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "compat@example.invalid");
  git(dir, "config", "user.name", "compat");
  git(dir, "config", "core.autocrlf", "false");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", `as ${version} wrote it`);
  return dir;
}

const versions = fs
  .readdirSync(COMPAT)
  .filter((v: string) => fs.statSync(path.join(COMPAT, v)).isDirectory());

test("REQ-570: there is a project of every version the compatibility promise covers", () => {
  assert.ok(versions.includes("0.35.0"), "0.35.0, the last version before 1.0");
});

for (const version of versions) {
  test(`REQ-570 SCN-570a: a project ${version} wrote, read by this build`, () => {
    const dir = copyOf(version);
    assert.equal(sg(dir, "validate", ".").status, 0, "it validates as it is");
    const status = JSON.parse(sg(dir, "status", "--json").stdout);
    assert.ok(Array.isArray(status.requirements), "status reads it");

    if (Number(version.split(".")[0]) < 1) {
      // Older than 1.0: status names the migration, and one command does it.
      assert.ok(status.migrate, "status names the migration");
      const m = sg(dir, "migrate", "1.0", "--json");
      assert.equal(m.status, 0, m.out);
      git(dir, "add", "-A");
      git(dir, "commit", "-qm", "migrated");
      assert.equal(JSON.parse(sg(dir, "status", "--json").stdout).migrate, undefined);
    }

    const v = sg(dir, "validate", ".", "--strict");
    assert.equal(v.status, 0, v.out);
    const config = sg(dir, "config", "list", "--json");
    assert.equal(config.status, 0, config.out);
    for (const change of JSON.parse(sg(dir, "change", "list", "--json").stdout).changes || []) {
      const cv = sg(dir, "change", "validate", change.id);
      assert.equal(cv.status, 0, `${change.id}: ${cv.out}`);
      const show = JSON.parse(sg(dir, "change", "show", change.id, "--json").stdout);
      assert.equal(typeof show.change.approvals.approved, "boolean");
    }
  });
}

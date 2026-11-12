/**
 * fast-gate: a test file that passed on the same code is not run again
 * (REQ-516) — kept in the git folder beside the last gate result, never with
 * `--no-cache` or `--ci`, and re-run whenever anything it is judged on changed.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { git, removeProject, write } from "../helpers/project";
import { runCli } from "../helpers/cli";
import { edit, project, runs } from "../helpers/affected-project";

const json = (r: { stdout: string }) => JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));

function check(dir: string, ...flags: string[]) {
  const r = runCli(["check", dir, "--json", "--affected", ...flags]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = json(r);
  return {
    doc,
    selection: doc.selection,
    tests: doc.stages.find((s: { stage: string }) => s.stage === "tests"),
  };
}

test("REQ-516 SCN-516a: the same check twice, then a change to the code under test, then --no-cache", () => {
  const dir = project();
  try {
    edit(dir, "src/one.js", "\n");
    const first = check(dir);
    assert.deepEqual(first.selection.tests, ["test/one.test.js"]);
    assert.deepEqual(first.selection.cached, []);
    assert.deepEqual(runs(dir), [["test/one.test.js"]]);
    assert.ok(fs.existsSync(path.join(dir, ".git", "specgate", "test-cache.json")));

    const second = check(dir);
    assert.deepEqual(second.selection.cached, ["test/one.test.js"]);
    assert.equal(second.selection.command, null);
    assert.equal(second.tests.result, "passed");
    assert.equal(second.tests.command, null);
    assert.ok(second.doc.status.some((d: { code: string }) => d.code === "tests_cached"));
    assert.equal(runs(dir).length, 1, "nothing ran the second time");

    edit(dir, "src/one.js", "exports.again = 1;\n");
    const third = check(dir);
    assert.deepEqual(third.selection.cached, []);
    assert.equal(runs(dir).length, 2);

    const fourth = check(dir, "--no-cache");
    assert.deepEqual(fourth.selection.cached, []);
    assert.equal(runs(dir).length, 3);

    assert.equal(git(dir, "status", "--porcelain").stdout.trim(), "M src/one.js");
  } finally {
    removeProject(dir);
  }
});

test("REQ-516: a file the test imports changed — it runs again; a sibling requirement's code changed — it stays cached", () => {
  const dir = project();
  try {
    edit(dir, "src/one.js", "\n");
    edit(dir, "src/two.js", "\n");
    check(dir);
    assert.deepEqual(runs(dir), [["test/one.test.js", "test/two.test.js"]]);

    edit(dir, "src/two.js", "exports.more = 2;\n");
    let { selection } = check(dir);
    assert.deepEqual(
      selection.cached,
      ["test/one.test.js"],
      "REQ-001's test reaches nothing of REQ-002's"
    );
    assert.deepEqual(runs(dir).at(-1), ["test/two.test.js"]);

    edit(dir, "src/shared.js", "exports.zero = 0;\n");
    ({ selection } = check(dir));
    assert.ok(
      !selection.cached.includes("test/one.test.js"),
      "src/shared.js is imported by src/one.js"
    );
  } finally {
    removeProject(dir);
  }
});

test("REQ-516: a test that reads the file system is re-run on any source change; a failed run is forgotten", () => {
  const dir = project();
  try {
    write(
      dir,
      "test/one.test.js",
      '// REQ-001 SCN-001a\nconst fs = require("fs");\nconst { place } = require("../src/one");\n' +
        "if (place([1, 2]) !== 3) process.exit(1);\nfs.existsSync(__filename);\n"
    );
    edit(dir, "src/two.js", "\n");
    check(dir);
    edit(dir, "src/two.js", "exports.more = 2;\n");
    const { selection } = check(dir);
    assert.deepEqual(selection.cached, [], "the fs test cannot say what it read");

    // A failing run forgets what it ran: back on the code that passed, it runs again.
    const passed = fs.readFileSync(path.join(dir, "src", "two.js"), "utf8");
    write(dir, "src/two.js", "// REQ-002\nexports.cancel = () => false;\n");
    const r = runCli(["check", dir, "--json", "--affected"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    write(dir, "src/two.js", passed);
    const after = check(dir);
    assert.ok(
      !after.selection.cached.includes("test/two.test.js"),
      JSON.stringify(after.selection)
    );
  } finally {
    removeProject(dir);
  }
});

test("REQ-516: --ci never reads or writes the cache", () => {
  const dir = project();
  try {
    edit(dir, "src/one.js", "\n");
    const r = runCli(["check", dir, "--json", "--ci", "--affected"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(fs.existsSync(path.join(dir, ".git", "specgate", "test-cache.json")), false);
  } finally {
    removeProject(dir);
  }
});

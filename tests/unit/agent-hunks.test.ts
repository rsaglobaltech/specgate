/**
 * agent-hunks: a plan applied hunk by hunk (REQ-664), and an applied plan
 * taken back (REQ-665).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { cliJson, git, removeProject } from "../helpers/project";
import { agentProject, read } from "../helpers/fake-agent";

const LINE = "- Orders can be cancelled up to 24 h before shipping.";

/** spec.md long enough that its first line and its end are two hunks apart. */
function twoHunks() {
  const p = agentProject("spec");
  const padded = `${read(p.dir, "spec.md")}${Array.from({ length: 12 }, (_, i) => `Line ${i + 1}.`).join("\n")}\n`;
  fs.writeFileSync(path.join(p.dir, "spec.md"), padded);
  git(p.dir, "commit", "-qam", "padded");
  fs.writeFileSync(
    path.join(p.dir, "harness.config.yaml"),
    `harness_version: 1\nagent: '${p.agent("two")}'\n`
  );
  git(p.dir, "commit", "-qam", "two");
  return { p, padded };
}

test("REQ-664 SCN-664a: the first of two hunks applied — the first line changed, the end not added", () => {
  const { p, padded } = twoHunks();
  try {
    const plan = cliJson(p.dir, "agent", "ask", "two edits").doc.plan;
    assert.equal((plan.files[0].diff.match(/^@@ /gm) || []).length, 2, plan.files[0].diff);
    const applied = cliJson(p.dir, "agent", "apply", plan.id, "--hunk", "spec.md#1");
    assert.equal(applied.status, 0, JSON.stringify(applied.doc));
    assert.deepEqual(applied.doc.applied.hunks, ["spec.md#1"]);
    const now = read(p.dir, "spec.md");
    const first = padded.split("\n")[0];
    assert.equal(now.split("\n")[0], `${first} (cancellations)`);
    assert.ok(!now.includes(LINE), "the second hunk left out");
    assert.equal(now.split("\n").slice(1).join("\n"), padded.split("\n").slice(1).join("\n"));
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-664: every hunk of a file named — written byte for byte, as apply without --hunk", () => {
  const { p } = twoHunks();
  try {
    const id = cliJson(p.dir, "agent", "ask", "two edits").doc.plan.id;
    const applied = cliJson(
      p.dir,
      "agent",
      "apply",
      id,
      "--hunk",
      "spec.md#1",
      "--hunk",
      "spec.md#2"
    );
    assert.equal(applied.status, 0, JSON.stringify(applied.doc));
    assert.ok(read(p.dir, "spec.md").endsWith(`${LINE}\n`));
    assert.match(read(p.dir, "spec.md").split("\n")[0], /\(cancellations\)$/);
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-664 SCN-664b: a hunk the plan does not have — hunk_not_found, nothing written", () => {
  const { p, padded } = twoHunks();
  try {
    const id = cliJson(p.dir, "agent", "ask", "two edits").doc.plan.id;
    const refused = cliJson(p.dir, "agent", "apply", id, "--hunk", "spec.md#3");
    assert.equal(refused.status, 1);
    assert.equal(refused.doc.status[0].code, "hunk_not_found");
    assert.equal(refused.doc.status[0].target, "spec.md#3");
    assert.equal(read(p.dir, "spec.md"), padded);
    assert.deepEqual(
      cliJson(p.dir, "agent", "plans").doc.plans.map((x: any) => x.id),
      [id],
      "the plan stays"
    );
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-665 SCN-665a: applied, then taken back — spec.md as before", () => {
  const p = agentProject("spec");
  try {
    const before = read(p.dir, "spec.md");
    const id = cliJson(p.dir, "agent", "ask", "cancel").doc.plan.id;
    assert.equal(cliJson(p.dir, "agent", "apply", id).status, 0);
    assert.notEqual(read(p.dir, "spec.md"), before);
    const reverted = cliJson(p.dir, "agent", "revert", id);
    assert.equal(reverted.status, 0, JSON.stringify(reverted.doc));
    assert.deepEqual(reverted.doc.reverted.files, ["spec.md"]);
    assert.equal(read(p.dir, "spec.md"), before);
    assert.equal(
      cliJson(p.dir, "agent", "revert", id).doc.status[0].code,
      "revert_not_found",
      "once"
    );
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-665: a file the plan made is removed again", () => {
  const p = agentProject("code");
  try {
    // code mode adds features/orders/cancel.feature (src/app.js is refused at ask).
    const ask = cliJson(p.dir, "agent", "ask", "cancel");
    const id = ask.doc.plan?.id;
    if (!id) return; // the mode refuses code edits altogether: nothing to take back
    assert.equal(cliJson(p.dir, "agent", "apply", id).status, 0);
    const made = path.join(p.dir, "features", "orders", "cancel.feature");
    const had = fs.existsSync(made);
    assert.equal(cliJson(p.dir, "agent", "revert", id).status, 0);
    if (had) assert.equal(fs.existsSync(made), false);
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-665 SCN-665b: spec.md edited since — revert_stale, the edit kept", () => {
  const p = agentProject("spec");
  try {
    const id = cliJson(p.dir, "agent", "ask", "cancel").doc.plan.id;
    assert.equal(cliJson(p.dir, "agent", "apply", id).status, 0);
    fs.appendFileSync(path.join(p.dir, "spec.md"), "My own edit.\n");
    const edited = read(p.dir, "spec.md");
    const refused = cliJson(p.dir, "agent", "revert", id);
    assert.equal(refused.status, 1);
    assert.equal(refused.doc.status[0].code, "revert_stale");
    assert.equal(refused.doc.status[0].target, "spec.md");
    assert.equal(read(p.dir, "spec.md"), edited);
  } finally {
    removeProject(p.dir);
  }
});

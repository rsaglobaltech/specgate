/**
 * agent-ask: `specgate agent apply` writes exactly the plan, only on the base
 * it was made on, never commits (REQ-524), and runs the plan's checks — only
 * specgate's — answering what they found (REQ-525).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as path from "node:path";
import { cliJson, git, removeProject } from "../helpers/project";
import { agentProject, read } from "../helpers/fake-agent";

const REQUEST = "allow cancelling up to 24 h before shipping";
const LINE = "- Orders can be cancelled up to 24 h before shipping.";

test("REQ-524 SCN-524a: the first plan is applied byte for byte, nothing staged or committed; the second is plan_stale", () => {
  const p = agentProject("spec");
  try {
    const first = cliJson(p.dir, "agent", "ask", REQUEST).doc.plan.id;
    const second = cliJson(p.dir, "agent", "ask", REQUEST).doc.plan.id;
    assert.notEqual(first, second);
    const head = git(p.dir, "rev-parse", "HEAD").stdout.trim();
    const before = read(p.dir, "spec.md");

    const applied = cliJson(p.dir, "agent", "apply", first);
    assert.equal(applied.status, 0, JSON.stringify(applied.doc));
    assert.equal(applied.doc.applied.id, first);
    assert.deepEqual(applied.doc.applied.written, [{ path: "spec.md", change: "modify" }]);
    assert.equal(read(p.dir, "spec.md"), `${before}\n${LINE}\n`);
    assert.equal(git(p.dir, "rev-parse", "HEAD").stdout.trim(), head, "no new commit");
    assert.equal(git(p.dir, "diff", "--cached", "--name-only").stdout, "", "nothing staged");
    assert.equal(git(p.dir, "status", "--porcelain").stdout.trim(), "M spec.md");
    const ids = cliJson(p.dir, "agent", "plans").doc.plans.map((x: any) => x.id);
    assert.deepEqual(ids, [second], "the applied plan is gone");

    const after = read(p.dir, "spec.md");
    const stale = cliJson(p.dir, "agent", "apply", second);
    assert.equal(stale.status, 1);
    assert.equal(stale.doc.applied, null);
    assert.equal(stale.doc.status[0].code, "plan_stale");
    assert.equal(stale.doc.status[0].target, "spec.md");
    assert.match(stale.doc.status[0].fix, /specgate agent discard/);
    assert.equal(read(p.dir, "spec.md"), after, "nothing written");
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-524: CRLF line endings survive a plan, byte for byte", () => {
  const p = agentProject("spec");
  try {
    const crlf = read(p.dir, "spec.md").replace(/\r?\n/g, "\r\n");
    fs.writeFileSync(path.join(p.dir, "spec.md"), crlf);
    const id = cliJson(p.dir, "agent", "ask", REQUEST).doc.plan.id;
    const applied = cliJson(p.dir, "agent", "apply", id);
    assert.equal(applied.status, 0, JSON.stringify(applied.doc));
    assert.equal(read(p.dir, "spec.md"), `${crlf}\n${LINE}\n`);
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-524: an added file is written, and a file added since is stale", () => {
  const p = agentProject("code");
  try {
    const id = cliJson(p.dir, "agent", "ask", REQUEST).doc.plan.id;
    const second = cliJson(p.dir, "agent", "ask", REQUEST).doc.plan.id;
    const applied = cliJson(p.dir, "agent", "apply", id);
    assert.equal(applied.status, 0, JSON.stringify(applied.doc));
    assert.equal(read(p.dir, "features/orders/cancel.feature"), "Feature: Cancel\n");
    assert.equal(read(p.dir, "src/app.js"), "module.exports = {};\n", "refused edits stay out");
    const stale = cliJson(p.dir, "agent", "apply", second);
    const targets = stale.doc.status
      .filter((d: any) => d.code === "plan_stale")
      .map((d: any) => d.target)
      .sort();
    assert.deepEqual(targets, ["features/orders/cancel.feature", "spec.md"]);
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-524: an id no open plan has is plan_not_found", () => {
  const p = agentProject("spec");
  try {
    for (const id of ["20990101-000000-abcd", "../../config"]) {
      const r = cliJson(p.dir, "agent", "apply", id);
      assert.equal(r.status, 1);
      assert.equal(r.doc.status[0].code, "plan_not_found");
    }
  } finally {
    removeProject(p.dir);
  }
});

test("REQ-525 SCN-525a: specgate validate runs after the write; rm -rf src is refused and never runs", () => {
  const p = agentProject("rm");
  try {
    const asked = cliJson(p.dir, "agent", "ask", REQUEST).doc;
    assert.deepEqual(asked.plan.then, ["specgate validate"]);
    const refused = asked.status.filter((d: any) => d.code === "then_refused");
    assert.deepEqual(
      refused.map((d: any) => d.target),
      ["rm -rf src"]
    );

    const applied = cliJson(p.dir, "agent", "apply", asked.plan.id);
    assert.equal(applied.status, 0, JSON.stringify(applied.doc));
    const then = applied.doc.applied.then;
    assert.equal(then.length, 1);
    assert.equal(then[0].command, "specgate validate");
    // The fixture's matrix lags the REQ-001 it was given: validate says so, and it comes through.
    assert.equal(then[0].exit, 1, JSON.stringify(then[0]));
    assert.ok(then[0].findings.some((f: any) => f.code === "matrix_stale"));
    const failed = applied.doc.status.find((d: any) => d.code === "then_failed");
    assert.equal(failed.target, "specgate validate");
    assert.ok(fs.existsSync(path.join(p.dir, "src", "app.js")), "src is still there");
  } finally {
    removeProject(p.dir);
  }
});

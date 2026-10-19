/**
 * The harness scheduler: levels, and what a failure does to the work behind it.
 *
 * These tests drive `runLevels` with an injected dispatcher, so the whole
 * scheduling contract is exercised without git, without a worktree and without
 * an agent. What they cannot cover is a real parallel run — §12.11 of the
 * closure plan is emphatic that this loop only shows its defects against a
 * real agent, and that is still true of `--concurrency`.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

const { scheduleLevels, runLevels } = require("../../scripts/harness/run");
const { RequirementGraph } = require("../../scripts/lib/requirement-graph");

function req(id: string, dependsOn: string[] = []) {
  return { requirement: id, category: "NEEDS_TEST", dependsOn };
}

/** A dispatcher that records what it was asked to run and returns fixed verdicts. */
function fakeDispatcher(verdicts: Record<string, string> = {}) {
  const calls: string[][] = [];
  const fn = async (runnable: string[]) => {
    calls.push([...runnable]);
    return runnable.map((id) => ({
      requirement: id,
      category: "NEEDS_TEST",
      result: verdicts[id] || "pass",
      attempts: 1,
      branch: `harness/${id}`,
    }));
  };
  return Object.assign(fn, { calls });
}

const CTX: any = { projectDir: "/nowhere" };
const OPTS = (dispatcher: any, concurrency = 1) => ({
  concurrency,
  hintByReq: new Map(),
  runOne: dispatcher,
});

// ── Levels ────────────────────────────────────────────────────────────────────

test("independent requirements land in one level", () => {
  const { levels } = scheduleLevels([req("REQ-001"), req("REQ-002")]);
  assert.deepEqual(levels, [["REQ-001", "REQ-002"]]);
});

test("a dependency puts its dependent in a later level", () => {
  const { levels } = scheduleLevels([req("REQ-002", ["REQ-001"]), req("REQ-001")]);
  assert.deepEqual(levels, [["REQ-001"], ["REQ-002"]]);
});

test("a dependency outside this run does not hold the queue up", () => {
  // `--req REQ-002` alone, or a dependency already DONE: waiting for something
  // that is not in the queue would deadlock the level for no reason.
  const { levels, dependsOn } = scheduleLevels([req("REQ-002", ["REQ-001"])]);
  assert.deepEqual(dependsOn["REQ-002"], []);
  assert.deepEqual(levels, [["REQ-002"]]);
});

// ── Cascade ───────────────────────────────────────────────────────────────────

test("the cascade reaches the whole chain, not just the next link", () => {
  const graph = RequirementGraph.fromDependencies(["REQ-001", "REQ-002", "REQ-003"], {
    "REQ-001": [],
    "REQ-002": ["REQ-001"],
    "REQ-003": ["REQ-002"],
  });
  assert.deepEqual([...graph.transitiveDependents("REQ-001")], ["REQ-002", "REQ-003"]);
});

test("a failure blocks what waits on it instead of failing it too", async () => {
  const dispatcher = fakeDispatcher({ "REQ-001": "fail" });
  const results = await runLevels(
    [req("REQ-001"), req("REQ-002", ["REQ-001"]), req("REQ-003", ["REQ-002"])],
    CTX,
    OPTS(dispatcher)
  );

  const byId = Object.fromEntries(results.map((r: any) => [r.requirement, r]));
  assert.equal(byId["REQ-001"].result, "fail");
  assert.equal(byId["REQ-002"].result, "blocked");
  assert.equal(byId["REQ-003"].result, "blocked", "the cascade reaches past the first link");

  // The point of blocking: the agent is never invoked for work that cannot start.
  assert.deepEqual(dispatcher.calls, [["REQ-001"]]);
  assert.equal(byId["REQ-002"].attempts, 0);
});

test("a blocked requirement says what it was waiting for", async () => {
  const results = await runLevels(
    [req("REQ-001"), req("REQ-002", ["REQ-001"])],
    CTX,
    OPTS(fakeDispatcher({ "REQ-001": "fail" }))
  );
  const blocked = results.find((r: any) => r.requirement === "REQ-002");
  assert.match(blocked.error, /REQ-001/);
  assert.match(blocked.error, /did not pass/);
});

test("a failure blocks only its own descendants", async () => {
  const dispatcher = fakeDispatcher({ "REQ-001": "fail" });
  const results = await runLevels(
    [req("REQ-001"), req("REQ-002", ["REQ-001"]), req("REQ-003")],
    CTX,
    OPTS(dispatcher)
  );
  const byId = Object.fromEntries(results.map((r: any) => [r.requirement, r]));
  assert.equal(byId["REQ-003"].result, "pass", "an unrelated requirement still runs");
});

test("everything passing runs everything, in dependency order", async () => {
  const dispatcher = fakeDispatcher();
  const results = await runLevels(
    [req("REQ-003", ["REQ-002"]), req("REQ-002", ["REQ-001"]), req("REQ-001")],
    CTX,
    OPTS(dispatcher)
  );
  assert.deepEqual(dispatcher.calls, [["REQ-001"], ["REQ-002"], ["REQ-003"]]);
  assert.equal(results.filter((r: any) => r.result === "pass").length, 3);
});

test("with nothing declared, every requirement is dispatched in one level", async () => {
  // The compatibility promise: a project with no dependencies sees the queue
  // it has always seen.
  const dispatcher = fakeDispatcher();
  await runLevels([req("REQ-001"), req("REQ-002"), req("REQ-003")], CTX, OPTS(dispatcher));
  assert.deepEqual(dispatcher.calls, [["REQ-001", "REQ-002", "REQ-003"]]);
});

// ── Cycles ────────────────────────────────────────────────────────────────────

test("a cycle is reported as blocked, never attempted and never hung on", async () => {
  const dispatcher = fakeDispatcher();
  const results = await runLevels(
    [req("REQ-001", ["REQ-002"]), req("REQ-002", ["REQ-001"]), req("REQ-003")],
    CTX,
    OPTS(dispatcher)
  );
  const byId = Object.fromEntries(results.map((r: any) => [r.requirement, r]));

  assert.equal(byId["REQ-003"].result, "pass", "the rest of the queue still runs");
  assert.equal(byId["REQ-001"].result, "blocked");
  assert.equal(byId["REQ-002"].result, "blocked");
  assert.match(byId["REQ-001"].error, /cycle/);
  assert.match(
    byId["REQ-001"].error,
    /specgate validate/,
    "points at the command that explains it"
  );
  assert.deepEqual(dispatcher.calls, [["REQ-003"]]);
});

// ── Base derivation (E1-03 / H9) ──────────────────────────────────────────────

/** A dispatcher that records the base each requirement was given. */
function baseRecordingDispatcher(verdicts: Record<string, string> = {}) {
  const bases: Record<string, string> = {};
  const fn = async (runnable: string[], _byId: any, _hints: any, ctx: any) => {
    for (const id of runnable) bases[id] = ctx.baseFor ? ctx.baseFor(id) : ctx.baseRef;
    return runnable.map((id) => ({
      requirement: id,
      category: "NEEDS_TEST",
      result: verdicts[id] || "pass",
      attempts: 1,
      branch: `harness/${id}`,
    }));
  };
  return Object.assign(fn, { bases });
}

const BASE_CTX: any = { projectDir: "/nowhere", baseRef: "HEAD" };

test("a requirement with no dependencies is cut from the run's base", async () => {
  const dispatcher = baseRecordingDispatcher();
  await runLevels([req("REQ-001")], BASE_CTX, OPTS(dispatcher));
  assert.equal(dispatcher.bases["REQ-001"], "HEAD");
});

test("a requirement is cut from the branch of the dependency it builds on", async () => {
  // H9: this is what removes the need to know the order and pass
  // `--base-branch` by hand. The dependency's code only exists on its branch.
  const dispatcher = baseRecordingDispatcher();
  await runLevels([req("REQ-001"), req("REQ-002", ["REQ-001"])], BASE_CTX, OPTS(dispatcher));
  assert.equal(dispatcher.bases["REQ-001"], "HEAD");
  assert.equal(dispatcher.bases["REQ-002"], "harness/REQ-001");
});

test("a dependency that did not pass contributes no base", async () => {
  const dispatcher = baseRecordingDispatcher({ "REQ-001": "fail" });
  const results = await runLevels(
    [req("REQ-001"), req("REQ-002", ["REQ-001"])],
    BASE_CTX,
    OPTS(dispatcher)
  );
  assert.equal(dispatcher.bases["REQ-002"], undefined, "REQ-002 was never dispatched");
  assert.equal(results.find((r: any) => r.requirement === "REQ-002").result, "blocked");
});

test("a dependency outside this run leaves the base alone", async () => {
  // Already DONE, or filtered out by `--req`: its work is in the run's base.
  const dispatcher = baseRecordingDispatcher();
  await runLevels([req("REQ-002", ["REQ-001"])], BASE_CTX, OPTS(dispatcher));
  assert.equal(dispatcher.bases["REQ-002"], "HEAD");
});

// ── The run's ceiling, across levels (C1) ────────────────────────────────────
//
// The budget is asked before each requirement, through the `mayStart` the
// scheduler hands the dispatcher. Two things have to hold, and only the second
// needs more than one level to show itself:
//
//   1. a single level respects the ceiling — independent requirements all land
//      in one, which is the common case;
//   2. requirements in a level the run never reaches are still *named*, rather
//      than dropped from the report as if they had not existed.

/** A dispatcher that honours `mayStart`, exactly as the real one does. */
function budgetedDispatcher() {
  const calls: string[][] = [];
  const fn = async (runnable: string[], _byId: any, _hints: any, ctx: any) => {
    calls.push([...runnable]);
    return runnable.map((id) => {
      if (ctx.mayStart && !ctx.mayStart()) {
        return {
          requirement: id,
          category: "NEEDS_TEST",
          result: "skipped",
          attempts: 0,
          branch: `harness/${id}`,
          error: `Not attempted: ${ctx.stopReason()}`,
        };
      }
      return {
        requirement: id,
        category: "NEEDS_TEST",
        result: "pass",
        attempts: 1,
        branch: `harness/${id}`,
      };
    });
  };
  return Object.assign(fn, { calls });
}

test("--max-requirements caps a single level", async () => {
  const dispatcher = budgetedDispatcher();
  const results = await runLevels(
    [req("REQ-001"), req("REQ-002"), req("REQ-003")],
    { ...CTX, maxRequirements: 2 },
    OPTS(dispatcher)
  );
  const byResult = results.reduce((acc: any, r: any) => {
    acc[r.result] = (acc[r.result] || 0) + 1;
    return acc;
  }, {});
  assert.equal(byResult.pass, 2);
  assert.equal(byResult.skipped, 1);
});

test("a level the budget never reaches is named, not dropped from the report", async () => {
  // The case a single level cannot show, and the ceiling has to be low enough
  // that the run stops *before* reaching level 2 — otherwise the dispatcher
  // skips REQ-003 itself and the scheduler's own accounting is never
  // exercised. Without it REQ-003 would simply be absent, and the run would
  // look complete and one requirement smaller than it was.
  const dispatcher = budgetedDispatcher();
  const results = await runLevels(
    [req("REQ-001"), req("REQ-002"), req("REQ-003", ["REQ-001"])],
    { ...CTX, maxRequirements: 1 },
    OPTS(dispatcher)
  );

  assert.deepEqual(dispatcher.calls, [["REQ-001", "REQ-002"]], "level 2 must never be dispatched");
  assert.equal(results.length, 3, `every requirement must appear: ${JSON.stringify(results)}`);
  const byId = Object.fromEntries(results.map((r: any) => [r.requirement, r]));
  assert.equal(byId["REQ-001"].result, "pass");
  assert.equal(byId["REQ-002"].result, "skipped");
  assert.equal(byId["REQ-003"].result, "skipped");
  assert.match(byId["REQ-003"].error, /--max-requirements 1 reached/);
  assert.equal(byId["REQ-003"].attempts, 0);
});

test("with no ceiling the scheduler behaves exactly as before", async () => {
  const dispatcher = budgetedDispatcher();
  const results = await runLevels(
    [req("REQ-001"), req("REQ-002"), req("REQ-003", ["REQ-001"])],
    CTX,
    OPTS(dispatcher)
  );
  assert.equal(results.filter((r: any) => r.result === "pass").length, 3);
});

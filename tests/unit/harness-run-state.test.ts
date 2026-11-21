/**
 * What one run keeps while it goes is the run's own. It used to be variables
 * of a module: two runs in one process — or one test after another — read each
 * other's spend, and "an agent has written in this run" stayed true for the
 * next. `RunState` is made per run and carried on its context.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { RunState, runStateOf } from "../../scripts/harness/run/state";

test("two runs share nothing", () => {
  const a = new RunState();
  const b = new RunState();
  a.addSpentUsd(1.25);
  a.markAgentWrote();
  a.notePackagesUsed("REQ-001", ["security", "security", "ux"]);
  assert.equal(a.spentUsdSoFar(), 1.25);
  assert.equal(a.agentWrote(), true);
  assert.deepEqual([...(a.packagesUsedBy("REQ-001") || [])], ["security", "ux"]);
  assert.equal(b.spentUsdSoFar(), 0);
  assert.equal(b.agentWrote(), false);
  assert.equal(b.packagesUsedBy("REQ-001"), undefined);
});

test("a context has one state, whoever asks first, and its copies keep it", () => {
  const ctx: { run?: RunState; hint?: string } = {};
  const run = runStateOf(ctx);
  assert.equal(runStateOf(ctx), run);
  // `runLevels` asks before it copies the context for each requirement.
  const copy = { ...ctx, hint: "for one requirement" };
  runStateOf(copy).addSpentUsd(2);
  assert.equal(run.spentUsdSoFar(), 2);
  assert.notEqual(runStateOf({}), run);
});

test("without a record open, writing it is nothing to do", () => {
  const run = new RunState();
  assert.equal(run.currentLedger(), null);
  run.ledgerWrite();
  run.ledgerAttempts([{ attempt: 1 }]);
  assert.equal(run.currentLedger(), null);
});

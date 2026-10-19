/**
 * A ceiling on what one run may spend (C1).
 *
 * `max_attempts` was the only limit the harness had. Fourteen requirements ×
 * 3 attempts × 1200 s is hours of wall-clock and an unbounded bill, and the
 * third real run ended because the account hit its monthly limit — the
 * expensive way to discover there was no ceiling of our own.
 *
 * The behaviour worth pinning is that exhausting a budget is not an error. A
 * run that dies halfway never writes its ledger, so `harness report` cannot say
 * what the money bought; a run that stops reports what it did.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  BUDGET_CODES,
  budgetVerdict,
  estimateRunCost,
  hasBudget,
} from "../../src/domain/RunBudget";

const T0 = 1_000_000;

test("no limits means never stop", () => {
  assert.equal(budgetVerdict({}, { startedAt: T0, started: 99 }, T0 + 9_000_000).stop, false);
  assert.equal(hasBudget({}), false);
  assert.equal(hasBudget({ budgetSeconds: 0, maxRequirements: 0 }), false);
});

test("the count ceiling stops the run once it is reached", () => {
  const limits = { maxRequirements: 3 };
  assert.equal(budgetVerdict(limits, { startedAt: T0, started: 2 }, T0).stop, false);
  const v = budgetVerdict(limits, { startedAt: T0, started: 3 }, T0);
  assert.equal(v.stop, true);
  assert.equal(v.code, BUDGET_CODES.COUNT);
  assert.match(v.reason, /--max-requirements 3 reached/);
});

test("the time ceiling stops the run once it is spent, and says how much went", () => {
  const limits = { budgetSeconds: 600 };
  assert.equal(budgetVerdict(limits, { startedAt: T0, started: 1 }, T0 + 599_000).stop, false);
  const v = budgetVerdict(limits, { startedAt: T0, started: 4 }, T0 + 601_000);
  assert.equal(v.stop, true);
  assert.equal(v.code, BUDGET_CODES.TIME);
  assert.match(v.reason, /601s/);
  assert.match(v.reason, /4 requirement\(s\) were attempted/);
});

test("the count ceiling is checked before the clock", () => {
  // Both exhausted at once should name the one a person set most deliberately;
  // either is defensible, so the order is pinned rather than left to chance.
  const v = budgetVerdict(
    { maxRequirements: 1, budgetSeconds: 1 },
    { startedAt: T0, started: 5 },
    T0 + 10_000
  );
  assert.equal(v.code, BUDGET_CODES.COUNT);
});

test("a clock that jumps backwards does not read as an exhausted budget", () => {
  // `now` before `startedAt` would otherwise produce a negative spend, and a
  // negative number compares as under budget — right answer, wrong reason. Pin
  // it so a future refactor cannot turn it into a stop at the first check.
  assert.equal(
    budgetVerdict({ budgetSeconds: 600 }, { startedAt: T0, started: 1 }, T0 - 5_000).stop,
    false
  );
});

// ── Declared cost, which is an estimate and says so ──────────────────────────

test("no declared hints means no estimate, rather than a confident zero", () => {
  // A number assembled from nothing invites belief it has not earned.
  assert.equal(estimateRunCost([["agent"], ["agent"]], {}), null);
});

test("hints multiply out over the attempts that used each profile", () => {
  const cost = estimateRunCost([["agent", "reviewer"], ["agent"]], { agent: 0.5, reviewer: 0.1 });
  assert.ok(cost);
  assert.equal(cost.total, 1.1);
  assert.equal(cost.covered, 3);
  assert.equal(cost.uncovered, 0);
});

test("attempts by a profile with no hint are counted, not silently folded in", () => {
  // Otherwise the total reads as complete when a third of the run is missing
  // from it.
  const cost = estimateRunCost([["agent"], ["mystery"], ["mystery"]], { agent: 0.5 });
  assert.ok(cost);
  assert.equal(cost.total, 0.5);
  assert.equal(cost.covered, 1);
  assert.equal(cost.uncovered, 2);
});

test("hints that are not usable numbers do not poison the total", () => {
  const cost = estimateRunCost([["agent"], ["broken"]], {
    agent: 0.5,
    broken: Number.NaN,
  });
  assert.ok(cost);
  assert.equal(cost.total, 0.5);
  assert.equal(cost.uncovered, 1);
});

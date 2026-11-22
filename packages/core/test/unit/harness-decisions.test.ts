/**
 * The edges of the harness's decisions, where a mutant survived: the exact
 * point a ceiling is reached, which limit a run has, what a requirement's
 * sessions reported, and the lines that say an agent cannot run or that the
 * specification — not the code — is what fails.
 *
 * Each case here is a rule that could be changed by one character without
 * another test noticing (`npm run mutation:harness`).
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { AttemptBudget } from "../../src/domain/AttemptBudget";
import { BUDGET_CODES, budgetVerdict, hasBudget, reportedCost } from "../../src/domain/RunBudget";
import { agentUnavailable, specSideFailure } from "../../src/domain/RetryPolicy";

const T0 = 1_000_000;
const usage = (tokens: number, cost?: number) => ({
  profile: "agent",
  input: tokens,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  ...(cost === undefined ? {} : { cost }),
});

// ── The requirement's ceiling ────────────────────────────────────────────────

test("tokens alone are a ceiling: under it, at it, and what it says", () => {
  const budget = new AttemptBudget("REQ-002", { maxTokens: 300 });
  budget.add(usage(299));
  assert.equal(budget.over(), false, "one token under is not over");
  budget.add(usage(1));
  assert.equal(budget.over(), true, "at the ceiling no further session runs");
  assert.match(budget.message(), /used 300 of its 300 tokens \(max_tokens\)/);
});

test("a cost ceiling is reached at the amount, not past it, and tokens do not reach it", () => {
  const budget = new AttemptBudget("REQ-002", { maxCostUsd: 0.5 });
  budget.add(usage(10_000_000, 0.49));
  assert.equal(budget.over(), false);
  budget.add(usage(1, 0.01));
  assert.equal(budget.over(), true);
  assert.match(budget.message(), /spent \$0\.50 of its \$0\.5 budget \(max_cost_usd\)/);
});

test("a session with no cost is not counted as costing anything", () => {
  const budget = new AttemptBudget("REQ-002", { maxCostUsd: 1 });
  budget.add(usage(100, 0.9));
  budget.add(usage(100));
  budget.add({ ...usage(100), cost: undefined });
  assert.equal(budget.over(), false);
  assert.match(
    new AttemptBudget("REQ-002", { maxCostUsd: 1 }).message(),
    /spent \$0\.00 of its \$1 budget/
  );
});

// ── The run's ceilings ───────────────────────────────────────────────────────

test("the time ceiling is reached at the second it names, not one after", () => {
  const limits = { budgetSeconds: 600 };
  assert.equal(budgetVerdict(limits, { startedAt: T0, started: 1 }, T0 + 599_999).stop, false);
  const at = budgetVerdict(limits, { startedAt: T0, started: 1 }, T0 + 600_000);
  assert.equal(at.stop, true);
  assert.equal(at.code, BUDGET_CODES.TIME);
  assert.match(at.reason, /--budget-seconds 600 exhausted after 600s; 1 requirement/);
});

test("the count ceiling is reached at the count, and past it", () => {
  assert.equal(
    budgetVerdict({ maxRequirements: 2 }, { startedAt: T0, started: 1 }, T0).stop,
    false
  );
  for (const started of [2, 3]) {
    const v = budgetVerdict({ maxRequirements: 2 }, { startedAt: T0, started }, T0);
    assert.equal(v.code, BUDGET_CODES.COUNT, String(started));
    assert.match(v.reason, new RegExp(`${started} requirement\\(s\\) were attempted`));
  }
});

test("the cost ceiling stops the run at what its agents reported", () => {
  const limits = { maxRunCostUsd: 2 };
  const state = (spentUsd?: number) => ({ startedAt: T0, started: 3, spentUsd });
  assert.equal(budgetVerdict(limits, state(), T0).stop, false, "nothing reported is nothing spent");
  assert.equal(budgetVerdict(limits, state(1.99), T0).stop, false);
  const at = budgetVerdict(limits, state(2), T0);
  assert.equal(at.stop, true);
  assert.equal(at.code, BUDGET_CODES.COST);
  assert.equal(
    at.reason,
    "max_run_cost_usd 2 reached: the run's agents reported $2.00; 3 requirement(s) were attempted."
  );
  assert.equal(budgetVerdict({ maxRunCostUsd: 0 }, state(99), T0).stop, false, "0 is no ceiling");
  assert.equal(budgetVerdict({}, state(99), T0).stop, false);
});

test("the clock is asked before the cost when both are spent", () => {
  const v = budgetVerdict(
    { budgetSeconds: 1, maxRunCostUsd: 1 },
    { startedAt: T0, started: 1, spentUsd: 5 },
    T0 + 5_000
  );
  assert.equal(v.code, BUDGET_CODES.TIME);
});

test("a verdict to go on carries no code and no reason", () => {
  const v = budgetVerdict({ maxRequirements: 5 }, { startedAt: T0, started: 0 }, T0);
  assert.deepEqual({ ...v }, { stop: false, code: null, reason: "" });
});

test("a run has a ceiling when any one of the three is set", () => {
  assert.equal(hasBudget({ budgetSeconds: 1 }), true);
  assert.equal(hasBudget({ maxRequirements: 1 }), true);
  assert.equal(hasBudget({ maxRunCostUsd: 0.01 }), true);
  assert.equal(hasBudget({ budgetSeconds: 0, maxRequirements: 0, maxRunCostUsd: 0 }), false);
  assert.equal(hasBudget({ budgetSeconds: -1, maxRequirements: -1, maxRunCostUsd: -1 }), false);
});

test("what a requirement's attempts reported is the sum of the costs they said", () => {
  assert.equal(reportedCost(undefined), 0);
  assert.equal(reportedCost([]), 0);
  assert.equal(reportedCost([{}, { usage: [] }]), 0);
  assert.equal(
    reportedCost([
      { usage: [{ cost: 0.25 }, {}] },
      { usage: [{ cost: 0.5 }, { cost: undefined }] },
      {},
    ]),
    0.75
  );
});

// ── An agent that cannot run now ─────────────────────────────────────────────

test("each way an agent says it cannot run is recognised, and the line is returned clean", () => {
  for (const line of [
    "usage limit reached",
    "Rate limit exceeded",
    "rate-limited by the provider",
    "you were rate limited",
    "quota exceeded for this key",
    "Quota exhausted",
    "error: insufficient_quota",
    "Your credit balance is too low",
    "Too Many Requests",
    "HTTP 429",
    '{"type":"overloaded_error"}',
  ]) {
    assert.equal(agentUnavailable(`starting\n   ${line}   \nbye`), line, line);
  }
  assert.equal(agentUnavailable("first\r\nsession limit\r\nlast"), "session limit");
  // A number that only contains 429, and "ratelimit" with nothing between, are not it.
  assert.equal(agentUnavailable("processed 14290 rows"), null);
  assert.equal(agentUnavailable("ratexlimit"), null);
});

// ── A gate that fails on the specification ───────────────────────────────────

const isFeature = (f: string) => f.startsWith("features/");

test("a located finding starts its line, with or without a line number", () => {
  assert.deepEqual(specSideFailure("  ▲  features/a.feature:3 vague step", isFeature), [
    "features/a.feature",
  ]);
  assert.deepEqual(specSideFailure("✖ features/b.feature title is generic", isFeature), [
    "features/b.feature",
  ]);
  assert.deepEqual(specSideFailure("⚠  features/c.feature:12 no Then", isFeature), [
    "features/c.feature",
  ]);
  // Quoted in the middle of a line, a marker locates nothing.
  assert.equal(
    specSideFailure("the gate printed ▲ features/a.feature:3 vague step", isFeature),
    null
  );
  // A path that ends the line names no finding after it.
  assert.equal(specSideFailure("  ▲  features/a.feature:3", isFeature), null);
});

test("a file blamed twice is named once, across either kind of line ending", () => {
  const out = [
    "  ▲  features/a.feature:3 vague step",
    "  ▲  features/a.feature:9 no Then",
    "  ✖  features/b.feature:1 title is generic",
  ].join("\r\n");
  assert.deepEqual(specSideFailure(out, isFeature), ["features/a.feature", "features/b.feature"]);
});

test("one finding outside the specification makes the whole failure the agent's", () => {
  const out = "  ▲  features/a.feature:3 vague step\n  ✖  src/a.ts:1 unused";
  assert.equal(specSideFailure(out, isFeature), null);
  assert.equal(specSideFailure("  ✖  features/a.feature Nothing proves it", isFeature), null);
  assert.equal(specSideFailure("", isFeature), null);
});

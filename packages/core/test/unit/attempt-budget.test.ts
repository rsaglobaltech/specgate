/**
 * The ceiling on one requirement's sessions (REQ-535, REQ-585), as a value:
 * what counts, when it is reached, and what it says.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { AttemptBudget, costKnown } from "../../src/domain/AttemptBudget";

const session = (cost?: number, tokens = 100) => ({
  profile: "agent",
  input: tokens,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  ...(cost === undefined ? {} : { cost }),
});

test("no limits: never over, whatever is spent", () => {
  const budget = new AttemptBudget("REQ-001", {});
  budget.add(session(50, 9_000_000));
  assert.equal(budget.over(), false);
  assert.equal(budget.limitsCost, false);
  assert.equal(new AttemptBudget("REQ-001", { maxCostUsd: 0, maxTokens: 0 }).over(), false);
});

test("cost: over once the sessions reach the ceiling, and it names both amounts", () => {
  const budget = new AttemptBudget("REQ-007", { maxCostUsd: 1 });
  assert.equal(budget.limitsCost, true);
  budget.add(session(0.4));
  assert.equal(budget.over(), false);
  budget.add(session(0.6));
  assert.equal(budget.over(), true);
  assert.equal(
    budget.message(),
    "budget_exceeded — REQ-007 spent $1.00 of its $1 budget (max_cost_usd), so no further session ran."
  );
});

test("tokens: every kind counts, and tokens are named before cost when both are reached", () => {
  const budget = new AttemptBudget("REQ-007", { maxCostUsd: 1, maxTokens: 1000 });
  budget.add({
    profile: "agent",
    input: 100,
    output: 200,
    cacheRead: 300,
    cacheWrite: 399,
    cost: 2,
  });
  assert.equal(budget.over(), true);
  assert.match(budget.message(), /max_cost_usd/);
  budget.add(session(undefined, 1));
  assert.equal(
    budget.message(),
    "budget_exceeded — REQ-007 used 1000 of its 1000 tokens (max_tokens), so no further session ran."
  );
});

test("a session with no cost, or no usage at all, adds nothing to what was spent", () => {
  const budget = new AttemptBudget("REQ-001", { maxCostUsd: 1 });
  budget.add(null);
  budget.add(session(undefined));
  assert.equal(budget.over(), false);
  assert.equal(costKnown(null), false);
  assert.equal(costKnown(session(undefined)), false);
  assert.equal(costKnown(session(0)), true);
});

/**
 * Fase 1.1: `done --check` was a no-op that printed a tick.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  planDoneVerification,
  planGateCheck,
  NO_TEST_COMMAND_WARNING,
} from "../../src/domain/DoneVerification";

test("without --check nothing runs — plain `done` stays a status write", () => {
  const plan = planDoneVerification("/p", { check: false, strict: false });
  assert.deepEqual(plan.steps, []);
  assert.equal(plan.testsUnverified, false, "not asked to verify is not the same as unverified");
});

test("--check validates", () => {
  const plan = planDoneVerification("/p", { check: true, strict: false });
  assert.deepEqual(
    plan.steps.map((s) => s.stage),
    ["validate"]
  );
  assert.deepEqual(plan.steps[0].argv, ["/p"]);
});

test("--strict asks for the gate the project can actually give", () => {
  // Following the documentation must not leave you with a weaker gate than the
  // tool supports — that was a cold evaluator's packaging complaint.
  // The whole gate: the old subset left out --strict-scenarios, so a scenario
  // of unfilled <placeholder> steps closed as Implemented.
  const plan = planDoneVerification("/p", { check: true, strict: true });
  assert.deepEqual(plan.steps[0].argv, ["/p", "--strict"]);
});

test("the requirement being closed is checked as delivered", () => {
  const plan = planDoneVerification("/p", { check: true, strict: true, reqId: "REQ-007" });
  assert.deepEqual(plan.steps[0].argv, ["/p", "--strict", "--delivering", "REQ-007"]);
});

test("a configured test command runs, and it runs after validate", () => {
  // validate is fast and its failures carry fixes; running a whole suite first
  // to then reject the row for a missing matrix header wastes the slow step.
  const plan = planDoneVerification("/p", { check: true, strict: false, testCmd: "npm test" });
  assert.deepEqual(
    plan.steps.map((s) => s.stage),
    ["validate", "tests"]
  );
  assert.deepEqual(plan.steps[1].argv, ["npm test"]);
  assert.equal(plan.testsUnverified, false);
});

test("no test command is reported as unverified, never as passed", () => {
  // The silent case must not be the flattering one.
  for (const testCmd of [undefined, "", "   "]) {
    const plan = planDoneVerification("/p", { check: true, strict: false, testCmd });
    assert.equal(plan.testsUnverified, true, `${JSON.stringify(testCmd)} should be unverified`);
    assert.deepEqual(
      plan.steps.map((s) => s.stage),
      ["validate"]
    );
  }
});

test("the warning says what was and was not checked", () => {
  assert.match(NO_TEST_COMMAND_WARNING.message, /specification, not the code/);
  assert.ok(NO_TEST_COMMAND_WARNING.fix.some((l) => l.includes("test_cmd")));
  // ADR-0035: `apply` is the daily verb; `done` is only its old name.
  assert.match(NO_TEST_COMMAND_WARNING.fix.join(" "), /`apply` and `check`/);
  assert.doesNotMatch(NO_TEST_COMMAND_WARNING.fix.join(" "), /`done`/);
});

// REQ-183 — the gate's placeholders outside the harness. `check` ran
// `node check.mjs {req}` with the literal text `{req}`, so a test command that
// names the requirement broke every `check` (fuhrerschein, S1).
test("REQ-183 SCN-183a: check runs the test command for the whole project, its placeholders empty", () => {
  const plan = planGateCheck(
    "/p",
    "npm test && node e2e-names.mjs {req} {scenario} {feature_file}"
  );
  const tests = plan.steps.find((s) => s.stage === "tests");
  assert.equal(tests?.argv[0], "npm test && node e2e-names.mjs");
});

test("REQ-183 SCN-183b: done and apply run it for the requirement they deliver", () => {
  const plan = planDoneVerification("/p", {
    check: true,
    strict: false,
    reqId: "REQ-007",
    testCmd: "npm test && node e2e-names.mjs {req}",
  });
  const tests = plan.steps.find((s) => s.stage === "tests");
  assert.equal(tests?.argv[0], "npm test && node e2e-names.mjs REQ-007");
});

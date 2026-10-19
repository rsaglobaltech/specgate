/**
 * Is this requirement fit to hand to an agent? (B2)
 *
 * `plan` has always known that a requirement's feature does not exist;
 * `harness run` never used it as a filter, so the agent found out halfway
 * through and the run spent `max_attempts` × the timeout discovering it. What
 * this changes is that "ready for an agent?" stops being the intuition of
 * whoever typed the command.
 *
 * The line worth holding is which checks *block*. A blocker means the agent
 * cannot succeed — not that the row is untidy.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { error } from "../../src/domain/Diagnostic";
import { READINESS_CODES, requirementReadiness } from "../../src/domain/RequirementReadiness";

const READY = {
  requirement: "REQ-001",
  status: "Draft",
  featureFile: "features/core/health.feature",
  featureExists: true,
  scenarioFindings: [],
  blockedBy: [],
  technicalDeclared: true,
  testDeclared: true,
};

const codes = (r: any) => r.blockers.map((b: any) => b.code);

test("a requirement with everything in place is ready and says nothing", () => {
  const r = requirementReadiness(READY);
  assert.equal(r.ready, true);
  assert.deepEqual(r.blockers, []);
});

test("no feature file blocks — there is no acceptance criterion to satisfy", () => {
  const r = requirementReadiness({ ...READY, featureExists: false });
  assert.equal(r.ready, false);
  assert.ok(codes(r).includes(READINESS_CODES.NO_FEATURE));
  assert.match(r.blockers[0].message, /features\/core\/health\.feature/);
  assert.match(r.blockers[0].fix ?? "", /specgate req link REQ-001 --feature/);
});

test("a scenario the gate cannot fail blocks, because a green run would prove nothing", () => {
  // H14 seen from planning: an empty scenario passes, so pointing an agent at
  // it buys a verdict that means nothing.
  const r = requirementReadiness({
    ...READY,
    scenarioFindings: [error("scenario_has_no_steps", "Cucumber sees no steps here.")],
  });
  assert.equal(r.ready, false);
  assert.ok(codes(r).includes(READINESS_CODES.UNRUNNABLE_SCENARIO));
});

test("a merely weak scenario does not block", () => {
  // Warnings weaken the signal; they do not counterfeit it. Blocking on them
  // would make every adopted repository unrunnable.
  const r = requirementReadiness({
    ...READY,
    scenarioFindings: [
      { severity: "warning", code: "scenario_too_few_steps", message: "only 2 step(s)." },
    ],
  });
  assert.equal(r.ready, true);
  assert.deepEqual(r.blockers, []);
});

test("unmet dependencies block, and the blocker names them", () => {
  const r = requirementReadiness({ ...READY, blockedBy: ["REQ-000", "REQ-002"] });
  assert.equal(r.ready, false);
  assert.match(r.blockers[0].message, /REQ-000, REQ-002/);
});

test("Deprecated blocks — nobody wants it built", () => {
  const r = requirementReadiness({ ...READY, status: "Deprecated" });
  assert.equal(r.ready, false);
  assert.ok(codes(r).includes(READINESS_CODES.NOT_WANTED));
});

test("Needs Clarification blocks, and says why that is not pedantry", () => {
  // An agent asked to settle a disagreement settles it by guessing, and the
  // guess arrives wearing a green gate.
  const r = requirementReadiness({ ...READY, status: "Needs Clarification" });
  assert.equal(r.ready, false);
  assert.ok(codes(r).includes(READINESS_CODES.NEEDS_CLARIFICATION));
  assert.match(r.blockers[0].message, /disputed/);
});

test("an ordinary in-progress status does not block", () => {
  for (const status of ["Draft", "Ready for Dev", "In Dev", "In Review", "Approved"]) {
    assert.equal(requirementReadiness({ ...READY, status }).ready, true, status);
  }
});

test("each undeclared artifact warns on its own, and neither blocks", () => {
  // A vague row does not stop the work, so these never block. They are reported
  // separately because "no test artifact" and "no production artifact" have
  // different fixes, and a single vague warning would earn a single vague
  // response.
  const r = requirementReadiness({ ...READY, technicalDeclared: false, testDeclared: false });
  assert.equal(r.ready, true, "an untidy row is not an impossible one");
  assert.deepEqual(codes(r), [
    READINESS_CODES.NO_TEST_ARTIFACT,
    READINESS_CODES.NO_TECHNICAL_ARTIFACT,
  ]);
  for (const b of r.blockers) assert.equal(b.severity, "warning");
});

test("a TBD test artifact is reported, and that is not the noise A2 had to avoid", () => {
  // `TBD` in the test column is not a false positive — it is an accurate
  // statement about an incomplete row, and TDD says that column is the one to
  // fill in first. The scaffolded project says TBD, so this fires on it by
  // design.
  const r = requirementReadiness({ ...READY, testDeclared: false });
  assert.deepEqual(codes(r), [READINESS_CODES.NO_TEST_ARTIFACT]);
  assert.match(r.blockers[0].fix ?? "", /--test/);
  assert.equal(r.ready, true);
});

test("every blocker carries a fix, because a blocker without one just stops you", () => {
  const r = requirementReadiness({
    requirement: "REQ-009",
    status: "Deprecated",
    featureExists: false,
    scenarioFindings: [error("scenario_has_no_steps", "x")],
    blockedBy: ["REQ-001"],
    technicalDeclared: false,
    testDeclared: false,
  });
  assert.equal(r.ready, false);
  assert.equal(r.blockers.length, 6, `got ${codes(r)}`);
  for (const b of r.blockers) {
    assert.ok(b.fix && b.fix.trim(), `${b.code} has no fix`);
    assert.equal(b.target, "REQ-009");
  }
});

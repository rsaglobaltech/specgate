/**
 * A board issue becoming a reviewable proposal (ADR-0021, E2-03).
 *
 * The load-bearing test in this file is the one asserting the scenario stays
 * unwritten. Everything else is presentation; that one is the design.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { inboundChangeId, planInboundChange } from "../../src/domain/InboundChange";

const issue = {
  key: "ACME-42",
  title: "Charge more at peak hours",
  body: "Customers on the flat tariff are subsidising peak load.\nFinance wants a peak rate.",
  url: "https://acme.atlassian.net/browse/ACME-42",
};

test("the change id derives from the issue, so a second pull is idempotent", () => {
  assert.equal(inboundChangeId("ACME-42"), "alm-acme-42");
  assert.equal(inboundChangeId("ACME-42"), inboundChangeId("ACME-42"));
  assert.equal(inboundChangeId("42"), "alm-42", "a bare GitHub number is a key too");
  assert.equal(inboundChangeId("weird//key!!"), "alm-weird-key");
});

test("the scenario is left unwritten, and says why", () => {
  // The whole point of ADR-0021 §4. A ticket has no executable acceptance
  // criterion; generating Gherkin from prose would invent the one thing the
  // spec exists to pin down, and `validate` would then be checking fiction.
  const plan = planInboundChange(issue, "REQ-014", "SCN-014");

  assert.match(plan.delta, /#### Scenario: SCN-014 — TODO/);
  assert.match(plan.delta, /- GIVEN <!--/);
  assert.match(plan.delta, /- WHEN <!--/);
  assert.match(plan.delta, /- THEN <!--/);
  assert.match(plan.delta, /deliberately unwritten/);

  // No step may arrive already written — that is the failure mode this guards.
  const steps = plan.delta.split("\n").filter((l) => /^- (GIVEN|WHEN|THEN) /.test(l));
  assert.equal(steps.length, 3);
  for (const step of steps) {
    assert.match(step, /<!--/, `a step arrived pre-written: ${step}`);
  }
});

test("the issue's own words are carried verbatim and marked as quoted", () => {
  // Summarising would put this tool's paraphrase where the reporter's intent
  // belongs, and a reviewer could not tell which was which.
  const plan = planInboundChange(issue, "REQ-014", "SCN-014");
  assert.match(plan.proposal, /> Customers on the flat tariff are subsidising peak load\./);
  assert.match(plan.proposal, /> Finance wants a peak rate\./);
  assert.match(plan.proposal, /Imported verbatim from the board/);
  assert.match(plan.proposal, /ACME-42/);
  assert.match(plan.proposal, /browse\/ACME-42/);
});

test("an issue with no description still yields a usable proposal", () => {
  const plan = planInboundChange({ ...issue, body: "" }, "REQ-001", "SCN-001");
  assert.match(plan.proposal, /the issue has no description/);
  assert.doesNotMatch(plan.proposal, /undefined|null/);
});

test("an issue with no title falls back to its key rather than an empty heading", () => {
  const plan = planInboundChange({ ...issue, title: "   " }, "REQ-001", "SCN-001");
  assert.match(plan.proposal, /^# Proposal: ACME-42$/m);
  assert.match(plan.delta, /### Requirement: REQ-001 — ACME-42/);
});

test("the delta records where the requirement came from", () => {
  // Provenance in the trace comment, which is the extension point this repo
  // already uses — and which `change archive` carries through.
  const plan = planInboundChange(issue, "REQ-014", "SCN-014");
  assert.match(plan.delta, /<!-- specgate:trace origin=alm:ACME-42 -->/);
});

test("the delta is an ADDED section the delta parser understands", () => {
  const plan = planInboundChange(issue, "REQ-014", "SCN-014");
  assert.match(plan.delta, /^## ADDED Requirements$/m);
  assert.match(plan.delta, /^### Requirement: REQ-014 — /m);
});

// ── the gate must refuse what `alm pull` writes ──────────────────────────────

import { isPlaceholderStep } from "../../src/domain/DeltaSpec";

test("a step that names a keyword and says nothing is a placeholder", () => {
  // The hole this closes: these are Gherkin by shape, so they passed every
  // check the delta validator made. A scenario built from them satisfies the
  // gate without asserting anything, which is the failure ADR-0021 called out
  // when it refused to import tickets with placeholder scenarios.
  for (const step of [
    "GIVEN <!-- the precondition -->",
    "- WHEN <!-- the action -->",
    "THEN",
    "WHEN TODO",
    "GIVEN TBD",
    "THEN ...",
    "GIVEN <something>",
  ]) {
    assert.ok(isPlaceholderStep(step), `${step} should read as unwritten`);
  }
});

test("a step that says something real is not a placeholder", () => {
  for (const step of [
    "GIVEN a customer on the flat tariff",
    "- WHEN consumption happens during peak hours",
    "THEN the peak rate is applied",
    "GIVEN a customer <!-- as created in SCN-001 -->",
  ]) {
    assert.equal(isPlaceholderStep(step), false, `${step} should read as written`);
  }
});

test("every step a pulled delta ships with reads as unwritten", () => {
  // The two halves have to agree: what `alm pull` writes must be exactly what
  // the gate refuses, or the empty scenario stops being a marker and becomes a
  // way through.
  const plan = planInboundChange(issue, "REQ-014", "SCN-014");
  const steps = plan.delta.split("\n").filter((l) => /^- (GIVEN|WHEN|THEN)/.test(l));
  assert.equal(steps.length, 3);
  for (const step of steps) {
    assert.ok(isPlaceholderStep(step), `pull wrote a step the gate would accept: ${step}`);
  }
});

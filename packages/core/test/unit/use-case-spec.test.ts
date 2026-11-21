/**
 * REQ-631: a use case's specification — overview, actors, preconditions, the
 * main flow and its alternatives, each naming the scenario that proves it —
 * read and checked against the scenarios of its requirements (#544).
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { checkUseCaseSpec, parseUseCaseSpec } from "../../src/domain/UseCaseSpec";

const SPEC = `# UC-004 — Create a child profile

## Overview

The tutor gives a child a profile of their own.

## Actors

- Tutor

## Preconditions

- The tutor is signed in.

## Main flow (SCN-012)

1. The tutor opens Profiles and presses "New profile".
2. The tutor writes a nickname and picks an avatar.
3. The system saves the profile and shows it in the list.

## Alternative flows

### A1 — The nickname is taken (at step 3) (SCN-013)

1. The system says the nickname is taken and keeps the form.

## Postconditions

- The child's profile exists, with no legal name.

## Business rules

- REQ-014: a profile asks for no legal name.
`;

test("REQ-631 SCN-631a: the specification read — its sections, the main flow and A1 with their steps and scenarios", () => {
  const s = parseUseCaseSpec(SPEC);
  assert.equal(s.id, "UC-004");
  assert.equal(s.name, "Create a child profile");
  assert.equal(s.overview, "The tutor gives a child a profile of their own.");
  assert.deepEqual(s.actors, ["Tutor"]);
  assert.deepEqual(s.preconditions, ["The tutor is signed in."]);
  assert.deepEqual(
    s.flows.map((f) => [f.id, f.title, f.atStep, f.scenarios, f.steps.length]),
    [
      ["main", "Main flow", null, ["SCN-012"], 3],
      ["A1", "The nickname is taken", 3, ["SCN-013"], 1],
    ]
  );
  assert.deepEqual(s.postconditions, ["The child's profile exists, with no legal name."]);
  assert.deepEqual(s.rules, [
    { requirement: "REQ-014", text: "REQ-014: a profile asks for no legal name." },
  ]);
  assert.deepEqual(checkUseCaseSpec(s, "UC-004", new Set(["SCN-012", "SCN-013"])), []);
});

test("REQ-631 SCN-631b: a scenario of the use case no flow names, and a flow naming one it does not have", () => {
  const s = parseUseCaseSpec(SPEC.replace("(SCN-013)", "(SCN-099)"));
  assert.deepEqual(
    checkUseCaseSpec(s, "UC-004", new Set(["SCN-012", "SCN-013"])).map(
      (f) => `${f.code}:${f.message}`
    ),
    [
      "ucs_unknown_scenario:UC-004: A1 names SCN-099, which no requirement of UC-004 has.",
      "ucs_scenario_unflowed:UC-004: SCN-013 is a scenario of its requirements, and no flow names it.",
    ]
  );
});

test("REQ-631: what else the check names — a wrong title, no overview, no main flow steps, a flow with no scenario, a step the main flow lacks", () => {
  const bad = `# UC-005 — Something

## Main flow

## Alternative flows

### A1 — Otherwise (at step 7) (SCN-013)

1. It differs.

### A2 — Again (SCN-012)
`;
  assert.deepEqual(
    checkUseCaseSpec(parseUseCaseSpec(bad), "UC-004", new Set(["SCN-012", "SCN-013"])).map(
      (f) => f.code
    ),
    [
      "ucs_wrong_id",
      "ucs_no_overview",
      "ucs_no_main_flow",
      "ucs_flow_untested",
      "ucs_bad_step",
      "ucs_bad_step",
      "ucs_empty_flow",
    ]
  );
});

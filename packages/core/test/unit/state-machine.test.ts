/**
 * REQ-637: an entity's state machine — its states, the transitions between
 * them each naming the requirement that asks for it, and the transitions no
 * one may take — read and checked. REQ-638: a change's delta to it, applied
 * at archive, refused when it leaves a state with transitions or names one
 * that is not there.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  applyStateMachineDelta,
  checkStateMachine,
  checkStateMachineDelta,
  parseStateMachine,
  parseStateMachineDelta,
  renderStateMachine,
  renderStateMachinePuml,
} from "../../src/domain/StateMachine";

const MACHINE = `# GenerationRequest — states

## States

- Received (initial) — entry / record
- Validating — do / guardrails
- Authorized — entry / reserve quota
- Available (final) — entry / show to the child
- Rejected (final) — entry / kind message

## Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Received | Validating | validate | REQ-011 |
| Validating | Authorized | validate [safe] | REQ-011 |
| Validating | Rejected | validate [unsafe] | REQ-046 |
| Authorized | Available | generate / save | REQ-018 |

## Forbidden

- Rejected → Available (REQ-034)
`;

const REQS = new Set(["REQ-011", "REQ-018", "REQ-034", "REQ-046"]);
const codes = (fs: ReadonlyArray<{ code: string }>) => fs.map((f) => f.code).sort();

test("REQ-637 SCN-637a: a state machine read — states, transitions with their requirement, the forbidden ones — has nothing to fix", () => {
  const m = parseStateMachine(MACHINE);
  assert.equal(m.name, "GenerationRequest");
  assert.deepEqual(
    m.states.map((s) => [s.name, s.initial, s.final, s.behaviour]),
    [
      ["Received", true, false, "entry / record"],
      ["Validating", false, false, "do / guardrails"],
      ["Authorized", false, false, "entry / reserve quota"],
      ["Available", false, true, "entry / show to the child"],
      ["Rejected", false, true, "entry / kind message"],
    ]
  );
  assert.deepEqual(m.transitions[1], {
    from: "Validating",
    to: "Authorized",
    trigger: "validate [safe]",
    requirements: ["REQ-011"],
    line: 16,
  });
  assert.deepEqual(m.forbidden, [
    { from: "Rejected", to: "Available", requirement: "REQ-034", line: 22 },
  ]);
  assert.deepEqual(checkStateMachine(m, REQS), []);
});

test("REQ-637 SCN-637b: an unknown state, an unknown requirement and a forbidden transition taken are errors", () => {
  const bad = MACHINE.replace(
    "| Authorized | Available | generate / save | REQ-018 |",
    "| Authorized | Availible | generate / save | REQ-099 |\n| Rejected | Available | retry | REQ-011 |"
  );
  const fs = checkStateMachine(parseStateMachine(bad), REQS);
  assert.deepEqual(codes(fs.filter((f) => f.severity === "error")), [
    "sm_forbidden_used",
    "sm_unknown_requirement",
    "sm_unknown_state",
  ]);
  assert.match(
    fs.find((f) => f.code === "sm_forbidden_used")!.message,
    /Rejected → Available.*REQ-034/
  );
});

test("REQ-637 SCN-637c: a state nothing reaches, a state with no way out that is not final, and a transition no requirement asks for are warned", () => {
  const odd = MACHINE.replace(
    "- Rejected (final) — entry / kind message",
    "- Rejected — entry / kind message\n- Expired (final)"
  ).replace(
    "| Authorized | Available | generate / save | REQ-018 |",
    "| Authorized | Available | generate / save | - |"
  );
  const fs = checkStateMachine(parseStateMachine(odd), REQS);
  assert.deepEqual(codes(fs), ["sm_dead_end", "sm_transition_untraced", "sm_unreachable"]);
  assert.ok(fs.every((f) => f.severity === "warning"));
  assert.equal(fs.find((f) => f.code === "sm_unreachable")!.target, "Expired");
  assert.equal(fs.find((f) => f.code === "sm_dead_end")!.target, "Rejected");
});

test("REQ-637: no initial state, two of them, a state written twice, no states", () => {
  const none = MACHINE.replace("- Received (initial)", "- Received");
  assert.ok(codes(checkStateMachine(parseStateMachine(none), REQS)).includes("sm_no_initial"));
  const two = MACHINE.replace("- Validating —", "- Validating (initial) —");
  assert.ok(codes(checkStateMachine(parseStateMachine(two), REQS)).includes("sm_many_initial"));
  const dup = MACHINE.replace("- Authorized — entry / reserve quota", "- Authorized\n- Authorized");
  assert.ok(codes(checkStateMachine(parseStateMachine(dup), REQS)).includes("sm_duplicate_state"));
  assert.deepEqual(codes(checkStateMachine(parseStateMachine("# X — states\n"), REQS)), [
    "sm_no_states",
  ]);
});

test("REQ-637: rendered back, a machine reads the same", () => {
  const m = parseStateMachine(MACHINE);
  const again = parseStateMachine(renderStateMachine(m));
  assert.deepEqual(
    {
      ...again,
      transitions: again.transitions.map(({ line: _l, ...t }) => t),
      forbidden: again.forbidden.map(({ line: _l, ...f }) => f),
    },
    {
      ...m,
      transitions: m.transitions.map(({ line: _l, ...t }) => t),
      forbidden: m.forbidden.map(({ line: _l, ...f }) => f),
    }
  );
});

const DELTA = `# Delta — GenerationRequest

## ADDED States

- Paused — entry / tell the tutor

## MODIFIED States

- Available (final) — entry / show and keep

## ADDED Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Authorized | Paused | pause | REQ-018 |
| Paused | Authorized | resume | REQ-018 |

## MODIFIED Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Authorized | Available | generate / save | REQ-011, REQ-018 |

## REMOVED Forbidden

- Rejected → Available
`;

test("REQ-638 SCN-638a: a delta adds a state and its transitions, modifies one, lifts a forbidden one", () => {
  const d = parseStateMachineDelta(DELTA);
  assert.equal(d.name, "GenerationRequest");
  const base = parseStateMachine(MACHINE);
  assert.deepEqual(checkStateMachineDelta(d, base), []);
  const after = parseStateMachine(applyStateMachineDelta(base, d)!);
  assert.ok(
    after.states.some((s) => s.name === "Paused" && s.behaviour === "entry / tell the tutor")
  );
  assert.equal(
    after.states.find((s) => s.name === "Available")!.behaviour,
    "entry / show and keep"
  );
  assert.deepEqual(
    after.transitions.find((t) => t.from === "Authorized" && t.to === "Available")!.requirements,
    ["REQ-011", "REQ-018"]
  );
  assert.equal(after.transitions.length, 6);
  assert.deepEqual(after.forbidden, []);
  assert.deepEqual(checkStateMachine(after, REQS), []);
});

test("REQ-638 SCN-638b: removing a state that still has transitions is refused; one that is not there, too", () => {
  const d = parseStateMachineDelta(`# Delta — GenerationRequest

## REMOVED States

- Rejected
- Expired

## REMOVED Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Received | Authorized | skip | - |
`);
  const fs = checkStateMachineDelta(d, parseStateMachine(MACHINE));
  assert.deepEqual(codes(fs), ["sm_state_in_use", "sm_state_unknown", "sm_transition_unknown"]);
  assert.match(
    fs.find((f) => f.code === "sm_state_in_use")!.message,
    /Rejected.*Validating → Rejected/
  );
});

test("REQ-638 SCN-638c: removing the only transition a requirement names warns that the requirement is no longer in the machine", () => {
  const d = parseStateMachineDelta(`# Delta — GenerationRequest

## REMOVED Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Validating | Rejected | validate [unsafe] | REQ-046 |
`);
  const fs = checkStateMachineDelta(d, parseStateMachine(MACHINE));
  assert.deepEqual(codes(fs), ["sm_requirement_uncovered"]);
  assert.equal(fs[0]!.severity, "warning");
  assert.equal(fs[0]!.target, "REQ-046");
});

test("REQ-638: adding what exists is refused; a new machine comes from a delta of additions; removing every state removes the machine", () => {
  const again = parseStateMachineDelta(
    "# Delta — GenerationRequest\n\n## ADDED States\n\n- Received\n"
  );
  assert.deepEqual(codes(checkStateMachineDelta(again, parseStateMachine(MACHINE))), [
    "sm_state_exists",
  ]);
  const fresh = parseStateMachineDelta(
    "# Delta — Profile\n\n## ADDED States\n\n- Draft (initial)\n- Active (final)\n\n## ADDED Transitions\n\n| From | To | Trigger | Requirement |\n|---|---|---|---|\n| Draft | Active | save | REQ-011 |\n"
  );
  assert.deepEqual(checkStateMachineDelta(fresh, null), []);
  const made = parseStateMachine(applyStateMachineDelta(null, fresh)!);
  assert.equal(made.name, "Profile");
  assert.deepEqual(checkStateMachine(made, REQS), []);
  const gone = parseStateMachineDelta(
    "# Delta — Profile\n\n## REMOVED States\n\n- Draft\n- Active\n\n## REMOVED Transitions\n\n| From | To | Trigger | Requirement |\n|---|---|---|---|\n| Draft | Active | save | REQ-011 |\n"
  );
  assert.equal(applyStateMachineDelta(made, gone), null);
});

test("REQ-639 SCN-639a: PlantUML of a machine — states, initial and final, transitions labelled, the forbidden one as a note", () => {
  const puml = renderStateMachinePuml(parseStateMachine(MACHINE));
  assert.match(puml, /^@startuml GenerationRequest/);
  assert.match(puml, /\[\*\] --> Received/);
  assert.match(puml, /Validating --> Authorized : validate \[safe\]\\nREQ-011/);
  assert.match(puml, /Available --> \[\*\]/);
  assert.match(puml, /state "Received" as Received : entry \/ record/);
  assert.match(puml, /note .*Rejected → Available/s);
  assert.match(puml, /@enduml\n$/);
});

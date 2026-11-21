/**
 * REQ-638: archive applies a change's delta to an entity's state machine,
 * docs/specs/state-machines/<Entity>.md, and refuses one that removes a state
 * transitions still use or names a requirement that does not exist.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { planArchive, executeArchive } = require("../../scripts/change/archive");

const TRACEABILITY = `# Traceability Matrix

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-011 | SCN-011 | \`features/requests/REQ-011.feature\` | UC-007 | - | - | - | TBD | TBD | Approved |
| REQ-046 | SCN-046 | \`features/requests/REQ-046.feature\` | UC-007 | - | - | - | TBD | TBD | Approved |
`;

const MACHINE = `# GenerationRequest — states

## States

- Received (initial)
- Validating
- Rejected (final)
- Available (final)

## Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Received | Validating | validate | REQ-011 |
| Validating | Available | validate [safe] | REQ-011 |
| Validating | Rejected | validate [unsafe] | REQ-046 |
`;

const DELTA = `# Delta — requests

## ADDED Requirements

### Requirement: REQ-050 — A request can be paused

The system SHALL let the tutor pause a request that is being validated.

#### Scenario: SCN-050 — Paused

- GIVEN a request being validated
- WHEN the tutor pauses it
- THEN it is paused

<!-- specgate:trace uc=UC-007 feature=features/requests/REQ-050.feature -->
`;

function project(machineDelta: string, machine: string | null = MACHINE) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-sm-"));
  const write = (rel: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), contents, "utf8");
  };
  const id = "pause-requests";
  write("spec.md", "# Spec\n");
  write("docs/specs/traceability.md", TRACEABILITY);
  if (machine) write("docs/specs/state-machines/GenerationRequest.md", machine);
  write(`docs/specs/changes/${id}/proposal.md`, "# Proposal\n");
  write(`docs/specs/changes/${id}/tasks.md`, "# Tasks\n\n- [x] 1.1 done\n");
  write(
    `docs/specs/changes/${id}/change.yaml`,
    "specgate_change_version: 1\nschema: spec-driven\ncreated: 2026-11-21\nrigor: lite\nskip_specs: false\nretire_capabilities: false\n"
  );
  write(`docs/specs/changes/${id}/specs/requests/spec.md`, DELTA);
  write(
    `docs/specs/changes/${id}/features/requests/REQ-050.feature`,
    "Feature: Pause\n\n  Scenario: Paused\n    Given a request\n"
  );
  write(`docs/specs/changes/${id}/state-machines/GenerationRequest.md`, machineDelta);
  return { root, id };
}

const machineOf = (root: string) =>
  fs.readFileSync(path.join(root, "docs/specs/state-machines/GenerationRequest.md"), "utf8");

test("REQ-638 SCN-638d: archive adds Paused and its transitions, naming the change's own REQ-050", () => {
  const { root, id } = project(`# Delta — GenerationRequest

## ADDED States

- Paused — entry / tell the tutor

## ADDED Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Validating | Paused | pause | REQ-050 |
| Paused | Validating | resume | REQ-050 |
`);
  try {
    const plan = planArchive(root, id, { stamp: "2026-11-21" });
    assert.equal(plan.ok, true, JSON.stringify(plan.diagnostics));
    assert.deepEqual(plan.totals.stateMachines, { written: 1, removed: 0 });
    executeArchive(plan);
    const after = machineOf(root);
    assert.match(after, /- Paused — entry \/ tell the tutor/);
    assert.match(after, /\| Validating \| Paused \| pause \| REQ-050 \|/);
    assert.match(after, /\| Received \| Validating \| validate \| REQ-011 \|/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("REQ-638 SCN-638e: removing Rejected while Validating → Rejected uses it, and naming REQ-099, are refused; nothing is written", () => {
  const { root, id } = project(`# Delta — GenerationRequest

## REMOVED States

- Rejected

## ADDED Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Available | Received | again | REQ-099 |
`);
  try {
    const plan = planArchive(root, id, { stamp: "2026-11-21" });
    assert.equal(plan.ok, false);
    const codes = plan.diagnostics.map((d: { code: string }) => d.code).sort();
    assert.deepEqual(codes, ["sm_state_in_use", "sm_unknown_requirement"]);
    assert.equal(machineOf(root), MACHINE);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("REQ-638: a new entity's machine comes from a delta of additions", () => {
  const { root, id } = project(
    `# Delta — GenerationRequest

## ADDED States

- Received (initial)
- Done (final)

## ADDED Transitions

| From | To | Trigger | Requirement |
|---|---|---|---|
| Received | Done | finish | REQ-011 |
`,
    null
  );
  try {
    const plan = planArchive(root, id, { stamp: "2026-11-21" });
    assert.equal(plan.ok, true, JSON.stringify(plan.diagnostics));
    executeArchive(plan);
    assert.match(machineOf(root), /^# GenerationRequest — states/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

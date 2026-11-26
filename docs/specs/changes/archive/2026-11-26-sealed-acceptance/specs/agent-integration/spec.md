# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-760 — No tool of the agent writes a sealed test

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL refuse, in the guard of Claude Code, Codex and OpenCode, with `acceptance_sealed`, a file write, an edit, a patch or a shell command that writes, moves onto, removes or checks out a sealed acceptance test of an open change; and SHALL add the sealed files' hashes to the controls the outside judge reads, so that a change made where no hook runs is reported; and SHALL count a sealed acceptance test that names a requirement of the open change as the test written first.

> Measured on 2026-11-25: Kimi wrote one function for the product and another for the step definitions, and the scenarios ran green against the second.

#### Scenario: SCN-760a — Each road refused

- GIVEN `features/steps/fees.steps.ts` sealed
- WHEN the agent's tool asks to Write it, to apply a patch that touches it, or to run `sed -i … features/steps/fees.steps.ts`
- THEN each is refused with `acceptance_sealed`

#### Scenario: SCN-760b — Changed where no hook runs

- GIVEN the same sealed file and a run judged from outside
- WHEN the file is changed by a process the guard does not see
- THEN the judge reports the acceptance test of the change as changed

#### Scenario: SCN-760c — The sealed test came first

- GIVEN a sealed acceptance test that names REQ-002, committed before the agent starts, and no other test changed
- WHEN the agent's tool asks to write `src/fees.js`
- THEN the write is allowed: the sealed test is the test that names the requirement

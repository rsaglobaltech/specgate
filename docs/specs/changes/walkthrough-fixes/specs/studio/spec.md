# Delta — studio

## MODIFIED Requirements

### Requirement: REQ-206 — A draft is approved by a person

The system SHALL, with `specgate change approve <id>`, record in the change's change.yaml that a person approved it and when, refusing while the draft checklist has errors or a question it holds is open — except a question, or a finding, that concerns only requirements marked Needs Clarification (REQ-771) — and naming them; the record SHALL survive later rewrites of change.yaml; and Review SHALL list each open change not approved with its requirements as statement and Given/When/Then, the checklist as plain checks, and Approve enabled only when nothing blocks it. Each blocker SHALL be listed with the action that clears it — answering a question, confirming that the spec says an answer, opening the requirement the checklist names — and a question SHALL be matched by its exact id.

> Amended by studio-unblock: on 2026-11-08 Approve stayed disabled with no way to clear what blocked it, and a blocker naming Q10 hid Q1.

#### Scenario: SCN-206a — Approving a ready draft

- GIVEN draft-garaje passes its checklist and has no open question
- WHEN `specgate change approve draft-garaje` runs
- THEN change.yaml says approved with today's date, and the draft leaves Review

#### Scenario: SCN-206b — A draft with an open question is not approved

- GIVEN draft-garaje has an open question
- WHEN it is approved
- THEN it is refused naming the question, and change.yaml is unchanged

#### Scenario: SCN-206c — Every blocker with its action

- GIVEN draft-garaje with Q1 open and Q10 answered by hand but still blocking REQ-214
- WHEN Review is read
- THEN Approve is disabled, Q1 is listed with "answer" and Q10 with "it is in the spec", each once

<!-- specgate:trace actor=Developer feature=features/studio/REQ-206.feature kind=functional -->

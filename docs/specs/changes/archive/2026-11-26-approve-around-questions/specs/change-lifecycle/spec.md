# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-771 — A question on a requirement that waits does not block approving the rest

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL NOT refuse `specgate change approve <id>` for an open question whose `Blocks` names only requirements of the change marked Needs Clarification, nor for a draft finding that names only such requirements; and SHALL refuse it, as before, for an open question that blocks any requirement not so marked.

> Found on 2026-11-26 following the getting-started guide: one question for the client blocked approving the whole draft, and since delivery waits for approval, every requirement of it.

#### Scenario: SCN-771a — The rest goes ahead

- GIVEN draft-bookings with REQ-002, REQ-003 and REQ-004, REQ-004 marked Needs Clarification and Q1, open, blocking REQ-004
- WHEN a person runs `specgate change approve draft-bookings`
- THEN the change is approved, `specgate apply REQ-002` can deliver REQ-002, and `specgate apply REQ-004` is refused with `done_needs_clarification`

#### Scenario: SCN-771b — A question on a decided requirement still blocks

- GIVEN the same draft with Q2, open, blocking REQ-003, which is not marked Needs Clarification
- WHEN a person runs `specgate change approve draft-bookings`
- THEN it is refused with `approve_blocked`, naming Q2

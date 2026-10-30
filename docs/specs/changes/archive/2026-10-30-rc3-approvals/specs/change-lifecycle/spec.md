# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-370 — A ticked task keeps the approval of the tasks

The system SHALL take the approved content of a layer with its task boxes read as open, so that ticking a task — as delivering its requirement does (REQ-353), or by a person — keeps the layer's approvals, while any other edit of the layer still asks for them again (REQ-314).

#### Scenario: SCN-370a — The second requirement of an approved change

- GIVEN a layered change with REQ-002 and REQ-003, every layer approved
- WHEN REQ-002 is delivered and its task in tasks.md is ticked
- THEN the harness still accepts REQ-003 as approved

#### Scenario: SCN-370b — A task reworded after the approval

- GIVEN the same approved change
- WHEN a task of tasks.md is reworded
- THEN the harness refuses the change as not approved: tasks

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc3-approvals.test.ts -->

### Requirement: REQ-371 — Approvals recorded by the first candidates keep counting

The system SHALL accept an approval whose recorded hash is of the layer's text as written — the form 1.0.0-rc.1 and rc.2 recorded — as long as that text has not changed.

#### Scenario: SCN-371a — A record written by 1.0.0-rc.2

- GIVEN an approval of tasks.md recorded with the hash of its text as written, a task already ticked
- WHEN its approvals are read
- THEN the tasks are approved

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc3-approvals.test.ts -->

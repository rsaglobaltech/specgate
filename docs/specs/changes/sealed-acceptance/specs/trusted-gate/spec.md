# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-757 — A person approves a change's acceptance tests

<!-- specgate:trace status=Planned actor=Developer kind=functional -->

The system SHALL, on `specgate change approve <id> --layer acceptance`, read the change's `acceptance.md`, whose lines each name a test file and the scenarios of the change it proves, and record in the change's approvals the layer `acceptance` with a sha256 of each file; and SHALL refuse, recording nothing, when the design is not approved, when a listed file does not exist, or when a line names no scenario of the change's delta.

> Measured on 2026-11-25: on the trap tasks, agents with Specgate did no better than without it — the agent that wrote the code also wrote, or followed, the wrong test.

#### Scenario: SCN-757a — Sealed as they are

- GIVEN export-csv with its design approved and an `acceptance.md` listing `tests/acceptance/export.spec.ts — SCN-120a`
- WHEN a person runs `specgate change approve export-csv --layer acceptance` at a terminal
- THEN the change's approvals hold the layer `acceptance` with the sha256 of `tests/acceptance/export.spec.ts`

#### Scenario: SCN-757b — A test that proves no scenario

- GIVEN the same change, and a line of `acceptance.md` naming `SCN-999z`, which its delta does not have
- WHEN a person approves its acceptance
- THEN it fails naming the line and `SCN-999z`, and no acceptance approval is recorded

#### Scenario: SCN-757c — Any language

- GIVEN a Maven project whose `acceptance.md` lists `src/test/java/shop/FeesAcceptanceIT.java — SCN-130a`
- WHEN a person approves its acceptance
- THEN the file is sealed the same way

### Requirement: REQ-758 — A changed acceptance test fails the gate

<!-- specgate:trace status=Planned actor=Developer kind=functional -->

The system SHALL fail `specgate check`, and so refuse `apply`, with `acceptance_not_sealed` naming the file, when a sealed acceptance test differs from its seal or is gone, saying to restore it or have a person approve the new version; and SHALL NOT count a change of line endings as a difference.

#### Scenario: SCN-758a — One byte

- GIVEN export-csv with `tests/acceptance/export.spec.ts` sealed
- WHEN one byte of the file is changed and `specgate check` runs
- THEN the gate fails with `acceptance_not_sealed` naming the file

#### Scenario: SCN-758b — Approved again

- GIVEN the same change after the edit
- WHEN a person approves its acceptance again
- THEN `acceptance_not_sealed` is gone

### Requirement: REQ-759 — The gate runs the sealed tests with the project's command

<!-- specgate:trace status=Planned actor=Developer kind=functional -->

The system SHALL, for each open change with sealed acceptance tests, run the project's `acceptance_cmd`, with `{files}` replaced by the sealed paths, and fail the gate with `acceptance_red` and the command's last lines when it exits non-zero; and SHALL fail with `acceptance_no_command` when there are sealed tests and no `acceptance_cmd`; and SHALL NOT install anything in the project.

#### Scenario: SCN-759a — Red is red

- GIVEN sealed tests and `acceptance_cmd` set to a command that exits 1
- WHEN `specgate check` runs
- THEN the gate fails with `acceptance_red` and the command's output

#### Scenario: SCN-759b — No command

- GIVEN sealed tests and no `acceptance_cmd`
- WHEN `specgate check` runs
- THEN the gate fails with `acceptance_no_command`, and the project's files and dependencies are as they were

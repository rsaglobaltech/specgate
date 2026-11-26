# Delta — trusted-gate

## MODIFIED Requirements

### Requirement: REQ-757 — A person approves a change's acceptance tests

The system SHALL, on `specgate change approve <id> --layer acceptance`, read the change's `acceptance-tests.md`, whose lines each name a test file and the scenarios of the change it proves, and record in the change's approvals the layer `acceptance` with a sha256 of each file; SHALL refuse, recording nothing, when the design is not approved, when a listed file does not exist, or when a line names no scenario of the change's delta; and SHALL NOT read the change's `acceptance.md`, which is the sign-off checklist of `specgate acceptance`.

> Measured on 2026-11-25: on the trap tasks, agents with Specgate did no better than without it — the agent that wrote the code also wrote, or followed, the wrong test.

#### Scenario: SCN-757a — Sealed as they are

- GIVEN export-csv with its design approved and an `acceptance-tests.md` listing `tests/acceptance/export.spec.ts — SCN-120a`
- WHEN a person runs `specgate change approve export-csv --layer acceptance` at a terminal
- THEN the change's approvals hold the layer `acceptance` with the sha256 of `tests/acceptance/export.spec.ts`

#### Scenario: SCN-757b — A test that proves no scenario

- GIVEN the same change, and a line of `acceptance-tests.md` naming `SCN-999z`, which its delta does not have
- WHEN a person approves its acceptance
- THEN it fails naming the line and `SCN-999z`, and no acceptance approval is recorded

#### Scenario: SCN-757c — Any language

- GIVEN a Maven project whose `acceptance-tests.md` lists `src/test/java/shop/FeesAcceptanceIT.java — SCN-130a`
- WHEN a person approves its acceptance
- THEN the file is sealed the same way

#### Scenario: SCN-757d — The sign-off checklist is not a list of tests

- GIVEN export-csv with the sign-off checklist `specgate acceptance export-csv` wrote, and no `acceptance-tests.md`
- WHEN a person approves its acceptance
- THEN it fails with `acceptance_not_listed`, naming `acceptance-tests.md`, and `acceptance.md` is as `specgate acceptance` wrote it

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

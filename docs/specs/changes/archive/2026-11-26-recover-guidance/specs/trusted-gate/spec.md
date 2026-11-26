# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-787 — A red suite caused by another requirement says so, and how to repair it

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, when the project's tests fail during `specgate apply` and the failing tests name only requirements other than the ones being delivered, say in `done_tests_failed` which requirements are red and, as its fix, to repair their code — never their test — as part of the change, the design's scope judging new files only; SHALL name, in `specgate check`'s `check_tests_failed`, the requirements the failing tests name, with the same fix; and the instructions `specgate agents init` writes into AGENTS.md SHALL say the same.

> Measured on 2026-11-25: four of six Claude Code runs of the `recover` task stopped with their requirement done and REQ-001's test red, saying its repair was out of their scope.

#### Scenario: SCN-787a — REQ-001 is red while REQ-002 is delivered

- GIVEN REQ-002 with its test passing, and REQ-001's test failing
- WHEN the developer runs `specgate apply REQ-002`
- THEN it is refused with `done_tests_failed`, naming REQ-001, and its fix says to repair REQ-001's code, not its test

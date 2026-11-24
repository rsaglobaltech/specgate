# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-697 — An exam check the agent does not see

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-697.feature actor=Developer kind=functional -->

The system SHALL read a task's `check:` command and `check_files:` in eval.yaml, copy those files into the copy only after the agent finishes, run the command there, and count the run correct only when both `specgate check` and that command pass; the prompt mentions neither.

> Found on 2026-11-23: the task said "until `specgate check` passes", so the agent saw its criterion and two versions of the skill scored the same.

#### Scenario: SCN-697a — A hidden test fails

- GIVEN a task with `check: node --test hidden/` and `check_files: [hidden/fee.test.js]`, and an agent whose code passes `specgate check` and fails that test
- WHEN the Developer runs `specgate eval conventions --runs 1`
- THEN the run is not correct, and hidden/fee.test.js was not in the copy while the agent worked

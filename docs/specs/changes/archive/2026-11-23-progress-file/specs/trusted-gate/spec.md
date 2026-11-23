# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-654 — A command that takes time tells how far it is

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, when SPECGATE_PROGRESS_FILE names a file, have `specgate apply` and `specgate check` append to it one JSON line per stage as it starts and as it ends — `{ at, stage, state }`, the stage being validate, architecture, tests or the gate's others, the state running, passed, failed or skipped — a running architecture or tests stage naming in `log` the file its output goes to as it is written; it SHALL answer as it would without it, and write nothing when the variable is not set.

> A studio showed "Apply REQ-001" with a spinner for minutes: specgate said nothing until the end.

#### Scenario: SCN-654a — Apply, stage by stage

- GIVEN a project whose REQ-001 passes, and SPECGATE_PROGRESS_FILE set
- WHEN the Developer runs `specgate apply REQ-001 --json` with a test command that prints "health › reports healthy"
- THEN the file says validate running then passed, tests running then passed, each line with its time, and the tests' log holds "health › reports healthy"

#### Scenario: SCN-654b — A failing stage

- GIVEN the same project with a failing test
- WHEN the Developer runs `specgate apply REQ-001 --json`
- THEN the file's last line is tests failed, and apply still refuses with its evidence

#### Scenario: SCN-654c — The gate, stage by stage

- GIVEN the same project with its test command in harness.config.yaml
- WHEN the Developer runs `specgate check`
- THEN the file says validate running and how it ended, then tests running and how it ended

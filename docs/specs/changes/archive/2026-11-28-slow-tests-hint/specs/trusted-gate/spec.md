# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-802 — A slow delivery names the faster command

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, when `specgate apply` delivers a requirement and its test command took two minutes or more, while that command has neither `{files}` nor `{req}`, say after the delivery that the whole suite ran for one requirement, how long it took, and the command that runs only its tests: `specgate config set test_cmd_affected "<the test command> {files}"`, naming `docs/fast-gate.md`; and SHALL say nothing of it when the run was quicker or the command already takes `{files}` or `{req}`.

> Reported on 2026-11-27: each apply ran the whole suite with Testcontainers, several minutes per requirement; the project did not know `test_cmd_affected` existed.

#### Scenario: SCN-802a — The whole suite, slowly

- GIVEN `test_cmd` is `node slow.js`, which takes longer than the limit, and no `test_cmd_affected`
- WHEN the Developer runs `specgate apply REQ-001`
- THEN REQ-001 is Implemented, and the output names `specgate config set test_cmd_affected "node slow.js {files}"` and `docs/fast-gate.md`

#### Scenario: SCN-802b — Already scoped

- GIVEN the same slow command, as `test_cmd_affected` with `{files}`
- WHEN the Developer runs `specgate apply REQ-001`
- THEN the output does not name `test_cmd_affected`

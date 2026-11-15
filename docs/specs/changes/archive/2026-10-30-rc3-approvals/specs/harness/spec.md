# Delta — harness

## ADDED Requirements

### Requirement: REQ-372 — A scratch file that cannot be removed never fails the command

The system SHALL remove the prompt files it writes for an agent (`change author`, the drafting agents, the harness) without ever failing the command when the file cannot be removed yet: it retries briefly on `EBUSY` or `EPERM`, then leaves the file to the system.

#### Scenario: SCN-372a — Windows still holds the prompt file

- GIVEN removing a prompt file fails with `EBUSY` twice, then succeeds
- WHEN the file is removed
- THEN it is removed on the third try and nothing is thrown

#### Scenario: SCN-372b — The file stays held

- GIVEN removing a prompt file always fails with `EBUSY`
- WHEN the file is removed
- THEN nothing is thrown, and the file is reported as left

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc3-approvals.test.ts -->

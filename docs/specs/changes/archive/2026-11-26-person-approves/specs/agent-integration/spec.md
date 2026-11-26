# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-749 — The exam proves which Specgate the agent reaches

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, in `specgate compat run` on the Developer's machine, put the `specgate` of the run's level first for the agent's login shell and for `npx`, and before the agent starts SHALL run `specgate --version` through the agent's login shell and through `npx --no-install`, with the agent's environment; and SHALL NOT start a run in which either reaches another `specgate`, recording it as invalid with `compat_cli_not_under_exam`, naming what answered.

> Measured on 2026-11-25: a login shell put the `specgate` installed for every project ahead of the one under exam, and the gate hook, through `npx`, found it too. Two batches measured an older Specgate before anyone saw.

#### Scenario: SCN-749a — The shell finds another

- GIVEN a login shell whose startup files put a folder with another `specgate` first
- WHEN `specgate compat run` prepares a run
- THEN the run is not started, and its line says `compat_cli_not_under_exam` and where the other `specgate` is

#### Scenario: SCN-749b — The one under exam, by both roads

- GIVEN a level with Specgate and a machine with `specgate` installed for every project
- WHEN `specgate compat run` prepares a run
- THEN both `specgate --version` in the login shell and `npx --no-install specgate --version` run the CLI under exam, and the run starts

#### Scenario: SCN-749c — The baseline reaches none

- GIVEN level B on the same machine
- WHEN `specgate compat run` prepares a run
- THEN both roads answer that `specgate` is not found, and the run starts

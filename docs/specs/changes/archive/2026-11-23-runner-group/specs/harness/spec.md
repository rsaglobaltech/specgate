# Delta — harness

## ADDED Requirements

### Requirement: REQ-592 — Nothing a command started outlives it

The system SHALL, whenever a command the harness runs ends — on its own, at its deadline, or by a signal to it, to its shell or to the run — end every process left in that command's process group before the harness goes on.

#### Scenario: SCN-592a — The shell ended by a signal

- GIVEN the harness running an agent that ignores SIGTERM, through a shell
- WHEN the shell is ended by SIGTERM
- THEN the agent is no longer running when the harness goes on

<!-- specgate:trace status=Implemented feature=features/harness/REQ-592.feature actor=Developer kind=functional -->

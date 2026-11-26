# Delta — harness

## ADDED Requirements

### Requirement: REQ-593 — A reused process number does not keep a lock

The system SHALL treat a run's lock, and the worktree lock, as held only while the process they name is alive and started no later than the lock was written, so that a process the system later gave the same number to does not keep the project locked; where the system does not say when a process started, the process number alone SHALL decide.

#### Scenario: SCN-593a — The number of a crashed run, taken by another program

- GIVEN a run lock written an hour ago naming a process number that a program started a moment ago now holds
- WHEN a new run asks for the lock
- THEN it takes it, and the lock it writes names its own process

<!-- specgate:trace status=Implemented feature=features/harness/REQ-593.feature actor=Developer kind=functional -->

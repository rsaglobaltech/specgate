# Delta — studio-port

## ADDED Requirements

### Requirement: REQ-445 — A studio already running is found, not fought

The system SHALL, when the studio's port is taken, ask what answers there: when it is a studio of the same project, say it is already running with its address and its process id and end without an error; when it is anything else and no `--port` was given, serve on the next free port among the ten that follow and say which; and when `--port` named the port, refuse naming what holds it.

#### Scenario: SCN-445a — The same project's studio is already running

- GIVEN a studio of the project serving on port 4173
- WHEN `specgate studio` is run again in that project
- THEN it says a studio of this project is already running at http://localhost:4173 with that studio's process id, ends with exit code 0, and starts no second server

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

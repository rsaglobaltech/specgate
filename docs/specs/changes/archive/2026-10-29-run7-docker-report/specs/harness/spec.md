# Delta — harness

## ADDED Requirements

### Requirement: REQ-279 — Docker is checked before the first attempt

The system SHALL, before the first attempt of `harness run` and before the studio's Build starts one, check that Docker runs Linux containers when the project needs it — a quality check with `runner: docker` or `docker: true`, or Testcontainers in a build file — and, when it does not, refuse before any agent runs, naming the fix (start Docker Desktop, or the docker daemon); and SHALL treat a test command whose output says Docker cannot be reached as an environment failure: told to the person with its output, never handed to the agent, and stopping the requirement without a further attempt.

#### Scenario: SCN-279a — Docker Desktop is stopped

- GIVEN a project whose quality check runs in Docker, an agent that writes a file, and Docker not running
- WHEN `harness run` starts
- THEN it exits non-zero saying Docker is not running and to start Docker Desktop, and the agent never runs

#### Scenario: SCN-279b — A project that needs no Docker

- GIVEN a project with no Docker check and no Testcontainers, and Docker not running
- WHEN `harness run` starts
- THEN the agent runs

#### Scenario: SCN-279c — Testcontainers cannot find Docker during the tests

- GIVEN a test command that prints "Could not find a valid Docker environment" and exits 1, and three attempts allowed
- WHEN `harness run` reaches the test command
- THEN it makes one attempt and says the tests need Docker, without handing the failure to the agent

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/harness-run7.test.ts -->

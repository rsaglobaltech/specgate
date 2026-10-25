# Delta — live-harness

## ADDED Requirements

### Requirement: REQ-175 — A base the gate already fails is said before any agent runs

The system SHALL, before `specgate harness run` creates a worktree or invokes an agent, validate the base with `validate --strict` as `specgate check` does, and when it fails TDD-1 or TDD-2 on a requirement outside the run (a status past Draft with no test, which no attempt may fix) SHALL stop with exit status 1, listing those findings and the fix (write those tests, move those requirements back to Draft, or `--skip-baseline`), with no `harness/REQ-NNN` branch created; findings about the requirements being run SHALL not stop it, and `--skip-baseline` SHALL run the requirements anyway.

#### Scenario: SCN-175a — A red base stops the run before the agent

- GIVEN a committed project where REQ-002 is Approved with no test, so `validate --strict` fails TDD-1
- WHEN the developer runs `specgate harness run --req REQ-001` with an agent configured
- THEN the run exits 1 saying the base already fails the gate on requirements outside the run, naming TDD-1 and `--skip-baseline`, the agent never runs and no `harness/*` branch exists

#### Scenario: SCN-175b — `--skip-baseline` runs it anyway

- GIVEN the same project
- WHEN the developer runs `specgate harness run --req REQ-001 --skip-baseline`
- THEN the agent runs

<!-- specgate:trace status=Draft test=tests/cli.test.ts actor=Developer kind=functional -->

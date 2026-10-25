Feature: A base the gate already fails is said before any agent runs

  @REQ-175 @SCN-175a
  Scenario: A red base stops the run before the agent
    Given a committed project where REQ-002 is Approved with no test, so `validate --strict` fails TDD-1
    When the developer runs `specgate harness run --req REQ-001` with an agent configured
    Then the run exits 1 saying the base already fails the gate on requirements outside the run, naming TDD-1 and `--skip-baseline`, the agent never runs and no `harness/*` branch exists

  @REQ-175 @SCN-175b
  Scenario: `--skip-baseline` runs it anyway
    Given the same project
    When the developer runs `specgate harness run --req REQ-001 --skip-baseline`
    Then the agent runs

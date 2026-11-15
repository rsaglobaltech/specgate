Feature: The agent decides only what its rights allow

  @REQ-547 @SCN-547a
  Scenario: The agent adds a library
    Given a decision-rights file with `dependency` set to `ask`, and an agent that implements REQ-001 and adds `left-pad` to `package.json`
    When a tool runs `specgate harness run --req REQ-001 --json`
    Then the attempt fails with `decision_right_exceeded` naming `dependency` and `package.json`

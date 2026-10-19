Feature: The agent knows which requirement it works on

  @REQ-125 @SCN-125a
  Scenario: An agent reads its requirement
    Given an agent command that writes the value of `SPECGATE_REQ` and `SPECGATE_ATTEMPT` to a file
    When the harness runs it for REQ-002
    Then the file reads `REQ-002 1`

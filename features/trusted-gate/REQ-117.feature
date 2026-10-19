Feature: Code and quotes in a step are not placeholders

  @REQ-117 @SCN-117a
  Scenario: A command in a step
    Given a delivered requirement whose scenario reads "THEN the developer sees `agentkit verify` followed by a module name in angle brackets and `--level fast`", written as a code span
    When the developer runs `specgate check`
    Then no `scenario_placeholder_step` and no `vague_step` finding is reported for that step
    And a step reading "GIVEN a customer named" followed by a bare angle-bracket placeholder still fails with `scenario_placeholder_step`

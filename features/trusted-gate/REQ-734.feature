Feature: Check runs the delivered requirements' scenarios

  @REQ-734 @SCN-734a
  Scenario: Code changed after delivery
    Given a project with `bdd: required`, REQ-004 Implemented, and code changed so REQ-004's scenario SCN-004a fails while the test command passes
    When the Developer runs `specgate check`
    Then the gate fails at the stage `scenarios` with `check_scenarios_failed` naming REQ-004 and SCN-004a

  @REQ-734 @SCN-734b
  Scenario: Left out at the Developer's word
    Given the same project
    When the Developer runs `specgate check --no-scenarios`
    Then the stage `scenarios` is reported skipped, naming the flag, and the other stages decide

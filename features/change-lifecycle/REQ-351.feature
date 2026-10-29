Feature: The agent writing a change's requirements is told what they need

  @REQ-351 @SCN-351a
  Scenario: The instructions for the specs of a layered change
    Given a layered change
    When `specgate change instructions specs <id>` runs
    Then its rules name `kind=`, `actor=` and one feature file per requirement

Feature: The gate and the doctor from the studio

  @REQ-440 @SCN-440a
  Scenario: The gate fails on a test, and says so
    Given a project whose test command fails
    When the gate is run from the studio
    Then Specification is shown passed, Tests failed with the command's output, and the gate as not passed

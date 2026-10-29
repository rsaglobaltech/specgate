Feature: The change command's help describes the three layers

  @REQ-354 @SCN-354a
  Scenario: The help of change new
    Given Specgate 1.0
    When `specgate change --help` runs
    Then the line for `new` names discover, design and tasks and not "proposal"

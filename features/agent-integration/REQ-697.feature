@change:lab-fixes
Feature: An exam check the agent does not see

  @REQ-697 @SCN-697a
  Scenario: A hidden test fails
    Given a task with `check: node --test hidden/` and `check_files: [hidden/fee.test.js]`, and an agent whose code passes `specgate check` and fails that test
    When the Developer runs `specgate eval conventions --runs 1`
    Then the run is not correct, and hidden/fee.test.js was not in the copy while the agent worked

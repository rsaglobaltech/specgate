@change:recover-guidance
Feature: A red suite caused by another requirement says so, and how to repair it

  @REQ-787 @SCN-787a
  Scenario: REQ-001 is red while REQ-002 is delivered
    Given REQ-002 with its test passing, and REQ-001's test failing
    When the developer runs `specgate apply REQ-002`
    Then it is refused with `done_tests_failed`, naming REQ-001, and its fix says to repair REQ-001's code, not its test

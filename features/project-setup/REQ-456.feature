Feature: The gate is green on a project just created

  @REQ-456 @SCN-456a
  Scenario: No test command yet
    Given a project just created by `specgate init`, with no `test_cmd`
    When its gate runs
    Then every step passes, and the tests step prints that no test command is configured and `specgate config set test_cmd "<command>"`

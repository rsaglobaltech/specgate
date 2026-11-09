Feature: A notice that says what happened

  @REQ-453 @SCN-453a
  Scenario: A preference saved
    Given Settings open
    When the test command is saved as `npm test`
    Then the notice says `specgate config set test_cmd` wrote it to harness.config.yaml and that the gate now runs it

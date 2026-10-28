Feature: The checks run in every harness attempt

  @REQ-220 @SCN-220a
  Scenario: A failing check fails the attempt
    Given a check `marker` that fails until src/ok.ts exists, and an agent that does not write it
    When the harness runs one attempt
    Then the requirement fails at `quality check: marker`

  @REQ-220 @SCN-220b
  Scenario: The agent reads the check's output and fixes it
    Given the same check, and an agent that writes src/ok.ts once its prompt carries the check's output
    When the harness runs two attempts
    Then the second passes

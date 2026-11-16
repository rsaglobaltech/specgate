Feature: Every command the harness runs ends at its deadline

  @REQ-575 @SCN-575a
  Scenario: A test command that hangs
    Given a harness run with `--timeout 4` whose test command ignores SIGTERM and never ends
    When the gate runs the test command
    Then the run ends within the deadline's margin and the test command is no longer running

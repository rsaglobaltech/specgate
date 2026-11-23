Feature: A command that takes time tells how far it is

  @REQ-654 @SCN-654a
  Scenario: Apply, stage by stage
    Given a project whose REQ-001 passes, and SPECGATE_PROGRESS_FILE set
    When the Developer runs `specgate apply REQ-001 --json` with a test command that prints "health › reports healthy"
    Then the file says validate running then passed, tests running then passed, each line with its time, and the tests' log holds "health › reports healthy"

  @REQ-654 @SCN-654b
  Scenario: A failing stage
    Given the same project with a failing test
    When the Developer runs `specgate apply REQ-001 --json`
    Then the file's last line is tests failed, and apply still refuses with its evidence

  @REQ-654 @SCN-654c
  Scenario: The gate, stage by stage
    Given the same project with its test command in harness.config.yaml
    When the Developer runs `specgate check`
    Then the file says validate running and how it ended, then tests running and how it ended

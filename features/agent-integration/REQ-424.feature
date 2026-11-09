Feature: The guards run on Windows

  @REQ-424 @SCN-424a
  Scenario: The gate on Windows
    Given a spec-driven project with a failing gate on Windows
    When the agent tries to end its session
    Then the stop is blocked with the gate's findings, as on macOS and Linux

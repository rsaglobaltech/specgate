Feature: The gate names the principles a repository follows

  @REQ-330 @SCN-330a
  Scenario: The workspace raised its principles
    Given a repository whose principles.md says `principles_version: 1.0.0` and `source: ../ws/principles.md`, and that file says `principles_version: 1.1.0`
    When the developer runs `specgate check --json`
    Then the gate passes, its result names the principles version 1.0.0, and a warning `principles_behind` names 1.0.0 and 1.1.0

  @REQ-330 @SCN-330b
  Scenario: Up to date
    Given the same repository after its principles.md says `principles_version: 1.1.0`
    When the developer runs `specgate check --json`
    Then no warning `principles_behind` is given

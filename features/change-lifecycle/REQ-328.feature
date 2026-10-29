Feature: The migration says what it did and what is left

  @REQ-328 @SCN-328a
  Scenario: The report of a real run
    Given a project with an open 0.27 change
    When the person runs `specgate migrate 1.0 --json`
    Then `docs/specs/migration-1.0.md` names the change and `discover.md`, `design.md`, and lists reviewing the drafted design as a manual step, and the JSON has the same steps

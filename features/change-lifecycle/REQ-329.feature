Feature: Status names the migration

  @REQ-329 @SCN-329a
  Scenario: A 0.27 project opened with 1.0
    Given a project with one open 0.27 change
    When the person runs `specgate status`
    Then the output names `specgate migrate 1.0` once, and `status --json` has `migrate.changes` = ["add-rates"]

Feature: The migration can be previewed, and runs once

  @REQ-326 @SCN-326a
  Scenario: A preview
    Given a project with an open 0.27 change
    When the person runs `specgate migrate 1.0 --dry-run --json`
    Then the report lists the change's actions, and no file in the project changed

  @REQ-326 @SCN-326b
  Scenario: A second run
    Given a project migrated and committed
    When the person runs `specgate migrate 1.0` again
    Then it exits 0, plans no action and leaves every file as it was

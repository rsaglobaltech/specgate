Feature: A published version is installed and used

  @REQ-572 @SCN-572a
  Scenario: The published package, installed
    Given the publish workflow
    When a version is published
    Then a job after it installs that version from npm, checks its dist-tag, and runs `--version`, `init` and `status`

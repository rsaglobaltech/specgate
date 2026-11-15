Feature: The studio is tested in a browser on the three systems

  @REQ-436 @SCN-436a
  Scenario: The studio's journey in CI
    Given the CI workflow on Windows, macOS and Linux
    When its browser tests run
    Then each section opens without a script error and the journey from an open question to a run in Live passes

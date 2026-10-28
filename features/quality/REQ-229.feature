Feature: The quality is shown where the work is followed

  @REQ-229 @SCN-229a
  Scenario: The harness report sums the quality up
    Given run records where REQ-002 passed with diff coverage 90% and mutation 80%, and REQ-003 with 70% and 60%
    When `specgate harness report --json` runs
    Then its quality says 2 measured, coverage 80, mutation 70, and each check with how often it ran

  @REQ-229 @SCN-229b
  Scenario: The studio's report shows each requirement's figures
    Given the same records and both requirements Implemented
    When the studio's report is read and downloaded
    Then REQ-002 carries coverage 90 and mutation 80, the means are 80 and 70, and the page says "Quality of the code"

  @REQ-229 @SCN-229c
  Scenario: A new project with a quality level, and turning it up later
    Given an empty folder and quality basic chosen in the new-project step
    When the project is created, then the studio turns on strict
    Then harness.config.yaml has `quality: basic` with the commits and secrets checks, the project page lists them, and after the switch it says strict

  @REQ-229 @SCN-229d
  Scenario: /live sees each check
    Given a requirement whose gate runs the checks `marker` and `final`
    When its attempt passes
    Then its events have the gate steps `quality: marker` and `quality: final`

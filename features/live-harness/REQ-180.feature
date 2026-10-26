Feature: A requirement of the live view opens into everything the project holds about it

  @REQ-180 @SCN-180a
  Scenario: The requirement's text, scenarios and where they live
    Given an open change whose delta defines REQ-024 with a scenario
    When the details of REQ-024 are read
    Then they hold its statement, its scenario with its steps, and the delta's path and line

  @REQ-180 @SCN-180b
  Scenario: The tests that name it, and every attempt with its files
    Given a test that names REQ-024 and events for two attempts, the first failed at the tests
    When the details of REQ-024 are read
    Then they list the test, both attempts with their results and the stage the first failed at, and the files the last changed

  @REQ-180 @SCN-180c
  Scenario: A later run's attempt 1 is the last attempt
    Given events of a run that failed on attempt 3, then of a later run whose attempt 1 passed
    When the live model is read
    Then the requirement's last attempt is the later run's attempt 1, passed

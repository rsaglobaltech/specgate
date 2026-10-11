Feature: A read and a denied attempt

  @REQ-407 @SCN-409
  Scenario: A read and a denied attempt
    Given the case of "Laura Gómez Pérez" held by "MED-1"
    When "MED-1" reads its timeline and "MED-2", outside the team, tries to
    Then the log has an "allowed" access by "MED-1" and a "denied" one by "MED-2", both for that patient

Feature: Before the diagnosis was confirmed

  @REQ-405 @SCN-407
  Scenario: Before the diagnosis was confirmed
    Given the diagnosis "J45.9" recorded on 2026-10-01 at 10:00 and confirmed on 2026-10-08 at 10:00
    When the physician "MED-1" reads the state of the case at 2026-10-05T10:00
    Then the diagnosis "J45.9" is "provisional"

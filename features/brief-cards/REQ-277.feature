Feature: D6 reads a date or a time as one value

  @REQ-277 @SCN-277a
  Scenario: A position with its time
    Given the step "GIVEN truck TRK-001 last reported 45.7640, 4.8357 at 2026-10-29 10:00:00"
    When D6 reads its values
    Then they are 45.7640, 4.8357 and 2026-10-29 10:00:00, and none is 29 or 00

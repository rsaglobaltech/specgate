Feature: Two at once for the last seat

  @REQ-305 @SCN-307
  Scenario: Two at once for the last seat
    Given the ticket type "VIP" (quota 1) without registrations
    When "ana@example.com" and "luis@example.com" register for "VIP" at the same time
    Then one is "confirmed" and the other "waitlisted"

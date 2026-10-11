Feature: Confirmed in one, waitlisted in another

  @REQ-306 @SCN-308
  Scenario: Confirmed in one, waitlisted in another
    Given "luis@example.com" confirmed for "Cloud Congress 2026" and second on the waitlist of "Retail Fair 2027"
    When he lists his registrations
    Then he sees both, the second with position 2

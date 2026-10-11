Feature: VIP sold out and a cancellation

  @REQ-304 @SCN-306
  Scenario: VIP sold out and a cancellation
    Given the ticket type "VIP" (quota 1) with "ana@example.com" confirmed
    When "luis@example.com" registers for "VIP" and then "ana@example.com" cancels
    Then "luis@example.com" is first "waitlisted" and then "confirmed", and the registration of "ana@example.com" is "cancelled"

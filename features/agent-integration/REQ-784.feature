Feature: A ready draft names the approval next

  @REQ-784 @SCN-784a
  Scenario: Ready to review
    Given the bookings draft passes its checklist and nobody approved it
    When the developer runs `specgate propose --from-brief bookings`
    Then its steps name `specgate change approve draft-bookings`, then `specgate apply`

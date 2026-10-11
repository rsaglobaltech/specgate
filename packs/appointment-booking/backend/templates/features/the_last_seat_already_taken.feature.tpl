Feature: The last seat already taken

  @REQ-505 @SCN-506
  Scenario: The last seat already taken
    Given "Hair" with 2 seats at 10:00 and 2 bookings at that time
    When a customer books at 10:00
    Then the response is 409 and no booking is created

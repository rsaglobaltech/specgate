Feature: Booking a free time

  @REQ-504 @SCN-505
  Scenario: Booking a free time
    Given a free time at 11:00 in "Hair"
    When a customer books the service at 11:00 with name, email and phone
    Then the response is 201 with a booking code

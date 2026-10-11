Feature: One seat, one booking

  @REQ-503 @SCN-504
  Scenario: One seat, one booking
    Given "Hair" with 1 seat from 10:00 to 12:00 and a booking at 10:00
    When a customer asks for free times that day for a 30-minute service
    Then 11:00 is offered and 10:00 is not

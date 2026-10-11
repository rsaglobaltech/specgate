Feature: Booking inside the lead time

  @REQ-507 @SCN-509
  Scenario: Booking inside the lead time
    Given "Salon 1" with a lead time of 2 hours and the time is 10:00
    When a customer books for 11:00 the same day
    Then the response is 422 and no booking is created

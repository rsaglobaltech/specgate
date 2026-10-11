Feature: Cancelling inside the lead time

  @REQ-509 @SCN-513
  Scenario: Cancelling inside the lead time
    Given "Salon 1" with a lead time of 2 hours and a booking at 11:00
    When at 10:00 the customer cancels it
    Then the response is 422 and the booking stands

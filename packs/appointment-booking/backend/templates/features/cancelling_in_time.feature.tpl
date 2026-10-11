Feature: Cancelling in time

  @REQ-509 @SCN-512
  Scenario: Cancelling in time
    Given a booking with its code
    When the customer cancels it with the code
    Then the response is 204 and the time is offered again

Feature: Tomorrow's agenda

  @REQ-510 @SCN-514
  Scenario: Tomorrow's agenda
    Given "Hair" with 2 bookings tomorrow
    When the owner reads the agenda of "Hair" for tomorrow
    Then both bookings are listed with time, service and customer

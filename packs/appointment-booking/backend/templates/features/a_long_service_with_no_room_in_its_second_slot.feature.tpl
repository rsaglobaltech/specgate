Feature: A long service with no room in its second slot

  @REQ-506 @SCN-508
  Scenario: A long service with no room in its second slot
    Given "Hair" with 1 seat at 10:00 and 0 seats at 11:00
    When a customer books a 90-minute service at 10:00
    Then the response is 409 and no booking is created

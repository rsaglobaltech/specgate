Feature: A second calendar

  @REQ-501 @SCN-501
  Scenario: A second calendar
    Given the owner of "Salon 1" with the calendar "Hair"
    When they create the calendar "Beauty"
    Then "Salon 1" has the calendars "Hair" and "Beauty"

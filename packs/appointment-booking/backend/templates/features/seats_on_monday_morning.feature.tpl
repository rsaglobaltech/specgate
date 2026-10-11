Feature: Seats on Monday morning

  @REQ-502 @SCN-502
  Scenario: Seats on Monday morning
    Given the calendar "Hair"
    When the owner sets 3 seats from 10:00 to 14:00 on Mondays
    Then every slot from 10:00 to 14:00 on Mondays has 3 seats

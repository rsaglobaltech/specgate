Feature: The units come back

  @REQ-608 @SCN-608
  Scenario: The units come back
    Given an order of 2 units of "Drill 500 W" and 10 in stock
    When the administrator cancels it
    Then "Drill 500 W" has 12 units again

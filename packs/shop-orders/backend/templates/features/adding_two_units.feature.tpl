Feature: Adding two units

  @REQ-604 @SCN-604
  Scenario: Adding two units
    Given a signed-in customer with an empty cart
    When they add 2 units of "Drill 500 W" at 49.90 EUR
    Then the cart total is 99.80 EUR

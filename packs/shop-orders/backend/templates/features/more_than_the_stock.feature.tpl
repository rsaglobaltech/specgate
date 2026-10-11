Feature: More than the stock

  @REQ-605 @SCN-605
  Scenario: More than the stock
    Given "Drill 500 W" with 12 units in stock
    When a customer adds 13 units to the cart
    Then the response is 422 with the reason "insufficient stock"

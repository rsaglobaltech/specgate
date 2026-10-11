Feature: Placing an order

  @REQ-606 @SCN-606
  Scenario: Placing an order
    Given a customer with 2 units of "Drill 500 W" in the cart and 12 in stock
    When they place the order with their delivery address
    Then the order is "pending payment" and 10 units are left in stock

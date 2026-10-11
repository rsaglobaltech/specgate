Feature: A delivered order

  @REQ-608 @SCN-609
  Scenario: A delivered order
    Given an order "delivered"
    When the administrator moves it to "cancelled"
    Then the response is 422 and the order stays "delivered"

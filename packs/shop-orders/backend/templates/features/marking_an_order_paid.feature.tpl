Feature: Marking an order paid

  @REQ-607 @SCN-607
  Scenario: Marking an order paid
    Given an order "pending payment"
    When the administrator moves it to "paid"
    Then the response is 200 and the customer sees it "paid"

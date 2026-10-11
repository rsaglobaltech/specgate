Feature: Shipping shown before confirming

  @REQ-609 @SCN-610
  Scenario: Shipping shown before confirming
    Given the shipping rule the merchant has chosen and a cart below its free-shipping threshold
    When the customer opens the cart
    Then the shipping cost and the total including it are shown before confirming

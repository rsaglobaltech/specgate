Feature: Insufficient balance

  @REQ-202 @SCN-203
  Scenario: Insufficient balance
    Given the account "ES0890000001250000000001" of customer "C-001" with 100.00 EUR
    When customer "C-001" transfers 150.00 EUR to "ES1690000001240000000003"
    Then the response is 409 with the error "insufficient_funds" and both balances are unchanged

Feature: Closing with money in the account

  @REQ-109 @SCN-113
  Scenario: Closing with money in the account
    Given the account "ES0890000001250000000001" of customer "C-001" with a balance of 750.50 EUR
    When customer "C-001" asks to close it
    Then the response is 409 with the error "balance_not_zero" and the account stays "active"

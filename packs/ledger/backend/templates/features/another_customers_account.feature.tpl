Feature: Another customer's account

  @REQ-107 @SCN-110
  Scenario: Another customer's account
    Given the account "ES0890000001250000000001" of customer "C-001"
    When customer "C-003" GETs the balance of that account
    Then the response is 404 with the error "account_not_found"

Feature: The balance after two deposits

  @REQ-105 @SCN-108
  Scenario: The balance after two deposits
    Given the account "ES0890000001250000000001" of customer "C-001" with deposits of 500.00 EUR and 250.50 EUR
    When customer "C-001" GETs the balance of the account
    Then the response is 200 with a balance of 750.50 EUR

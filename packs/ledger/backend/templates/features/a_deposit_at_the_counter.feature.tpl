Feature: A deposit at the counter

  @REQ-103 @SCN-104
  Scenario: A deposit at the counter
    Given the active account "ES0890000001250000000001" with a balance of 0.00 EUR
    When the operator "O-001" deposits 500.00 EUR with the description "Counter deposit"
    Then the response is 201 and the balance of the account is 500.00 EUR

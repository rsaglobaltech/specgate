Feature: A zero amount

  @REQ-103 @SCN-105
  Scenario: A zero amount
    Given the active account "ES0890000001250000000001"
    When the operator "O-001" deposits 0.00 EUR
    Then the response is 422 with the error "invalid_amount" and the balance does not change

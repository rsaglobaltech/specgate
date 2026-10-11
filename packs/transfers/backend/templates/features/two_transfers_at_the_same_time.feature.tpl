Feature: Two transfers at the same time

  @REQ-203 @SCN-204
  Scenario: Two transfers at the same time
    Given the account "ES0890000001250000000001" of customer "C-001" with 100.00 EUR
    When customer "C-001" sends two transfers of 80.00 EUR at the same time
    Then one is answered 201, the other 409 with the error "insufficient_funds", and the source is left with 20.00 EUR

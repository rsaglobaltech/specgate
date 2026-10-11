Feature: The same request sent twice

  @REQ-207 @SCN-209
  Scenario: The same request sent twice
    Given the account "ES0890000001250000000001" of customer "C-001" with 500.00 EUR
    When customer "C-001" sends the same transfer of 120.00 EUR twice with the Idempotency-Key "7f1c-rent-oct"
    Then both responses are 201 with the same transfer and the source has 380.00 EUR

Feature: An IBAN with one digit changed

  @REQ-204 @SCN-205
  Scenario: An IBAN with one digit changed
    Given the account "ES0890000001250000000001" of customer "C-001" with 500.00 EUR
    When customer "C-001" transfers 50.00 EUR to "ES8491000002161234567891"
    Then the response is 422 with the error "invalid_iban" and the source still has 500.00 EUR

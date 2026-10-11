Feature: An outgoing SEPA transfer

  @REQ-205 @SCN-206
  Scenario: An outgoing SEPA transfer
    Given the account "ES0890000001250000000001" of customer "C-001" with 500.00 EUR
    When customer "C-001" transfers 200.00 EUR to "ES8491000002161234567890" with the description "Invoice 2026-118"
    Then the response is 201 with the status "pending" and the source has 300.00 EUR

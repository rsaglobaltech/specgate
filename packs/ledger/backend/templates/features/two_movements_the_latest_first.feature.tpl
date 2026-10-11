Feature: Two movements, the latest first

  @REQ-106 @SCN-109
  Scenario: Two movements, the latest first
    Given the account "ES0890000001250000000001" with a deposit of 500.00 EUR on 2026-10-01 and one of 250.50 EUR on 2026-10-02
    When customer "C-001" GETs the movements of the account
    Then the response lists the 250.50 EUR deposit with balance 750.50 EUR first and the 500.00 EUR deposit with balance 500.00 EUR second

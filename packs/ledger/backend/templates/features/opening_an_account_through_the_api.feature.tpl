Feature: Opening an account through the API

  @REQ-101 @SCN-101
  Scenario: Opening an account through the API
    Given a customer "C-001" with KYC "verified" and no account at the bank
    When they POST /api/accounts with the type "current"
    Then the response is 201 with an IBAN, a balance of 0.00 EUR and the status "active"

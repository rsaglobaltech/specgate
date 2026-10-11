Feature: A customer without verified KYC

  @REQ-101 @SCN-102
  Scenario: A customer without verified KYC
    Given a customer "C-002" with KYC "pending"
    When they POST /api/accounts with the type "current"
    Then the response is 409 with the error "kyc_not_verified" and no account is created

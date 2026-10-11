Feature: A deposit into a blocked account

  @REQ-108 @SCN-111
  Scenario: A deposit into a blocked account
    Given the account "ES0890000001250000000001" blocked by operator "O-001" with the reason "court order"
    When the operator deposits 100.00 EUR into it
    Then the response is 409 with the error "account_blocked" and the balance does not change

Feature: Two own accounts and someone else's

  @REQ-110 @SCN-114
  Scenario: Two own accounts and someone else's
    Given customer "C-001" with two accounts and customer "C-003" with one
    When customer "C-001" GETs /api/accounts
    Then the response lists the two accounts of "C-001" with their balances and not the account of "C-003"

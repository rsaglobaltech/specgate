Feature: An amount that is not a number

  @REQ-211 @SCN-214
  Scenario: An amount that is not a number
    Given the account "ES0890000001250000000001" of customer "C-001"
    When customer "C-001" POSTs a transfer with the amount "abc"
    Then the response is 400 with the error "invalid_request"

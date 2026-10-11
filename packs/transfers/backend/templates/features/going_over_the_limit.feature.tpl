Feature: Going over the limit

  @REQ-208 @SCN-210
  Scenario: Going over the limit
    Given an account with 15000.00 EUR and 9000.00 EUR already transferred on 2026-10-01, with a daily limit of 10000.00 EUR
    When on 2026-10-01 the customer transfers 1500.00 EUR
    Then the response is 409 with the error "daily_limit_exceeded"

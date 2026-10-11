Feature: The next day

  @REQ-208 @SCN-211
  Scenario: The next day
    Given an account with 9000.00 EUR transferred on 2026-10-01 and 6000.00 EUR of balance
    When on 2026-10-02 the customer transfers 1500.00 EUR
    Then the response is 201 and the source has 4500.00 EUR

Feature: A blocked destination

  @REQ-201 @SCN-202
  Scenario: A blocked destination
    Given the source account with 500.00 EUR and the destination "ES1690000001240000000003" blocked
    When customer "C-001" transfers 120.00 EUR to it
    Then the response is 409 with the error "account_blocked" and the source still has 500.00 EUR

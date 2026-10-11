Feature: A transfer between two accounts of the bank

  @REQ-201 @SCN-201
  Scenario: A transfer between two accounts of the bank
    Given the account "ES0890000001250000000001" of customer "C-001" with 500.00 EUR and the account "ES1690000001240000000003" with 0.00 EUR
    When customer "C-001" transfers 120.00 EUR to "ES1690000001240000000003" with the description "October rent"
    Then the response is 201 with the status "completed", the source has 380.00 EUR and the destination 120.00 EUR

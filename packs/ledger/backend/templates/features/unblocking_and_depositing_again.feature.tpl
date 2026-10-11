Feature: Unblocking and depositing again

  @REQ-108 @SCN-112
  Scenario: Unblocking and depositing again
    Given the account "ES0890000001250000000001" blocked with the reason "court order"
    When the operator "O-001" unblocks it and then deposits 100.00 EUR
    Then the account is "active" again and its balance is 100.00 EUR

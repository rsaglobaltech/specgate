Feature: The entry of a deposit

  @REQ-104 @SCN-106
  Scenario: The entry of a deposit
    Given a deposit of 500.00 EUR into the account "ES0890000001250000000001"
    When the auditor "A-001" reads the journal entries
    Then the entry has a debit of 500.00 EUR on "Cash" and a credit of 500.00 EUR on "ES0890000001250000000001"

Feature: An unbalanced entry

  @REQ-104 @SCN-107
  Scenario: An unbalanced entry
    Given an entry with 500.00 EUR in debits and 490.00 EUR in credits
    When it is posted to the ledger
    Then it is refused with the error "unbalanced_entry" and the ledger does not change

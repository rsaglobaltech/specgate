@change:draft-fees
Feature: Late fee

  @REQ-002 @SCN-002a
  Scenario: Three days late
    Given a book returned 3 days late
    When the fee is computed
    Then the fee is 1.50

  @REQ-002 @SCN-002b
  Scenario: The cap
    Given a book returned 30 days late
    When the fee is computed
    Then the fee is 10.00

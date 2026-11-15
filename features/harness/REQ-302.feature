Feature: Both gaps, overall and per module

  @REQ-302 @SCN-302a
  Scenario: Two modules
    Given four requirements in the ledger, REQ-002 and REQ-003 of `flota` and REQ-012 and REQ-013 of `tracking`; REQ-002 spec → implementation and REQ-012 intent → spec
    When the report is read
    Then each gap is 1 of 4 (25 %), and `flota` shows 1 spec → implementation of 2 and `tracking` 1 intent → spec of 2

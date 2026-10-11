Feature: A rejected settlement and its refund

  @REQ-206 @SCN-207
  Scenario: A rejected settlement and its refund
    Given a pending SEPA transfer of 200.00 EUR with the description "Invoice 2026-118" from an account left with 300.00 EUR
    When the operator "O-001" records the result "rejected" with the reason "destination account closed"
    Then the transfer is "rejected", the source is back to 500.00 EUR and its latest movement is "Refund: Invoice 2026-118" for 200.00 EUR

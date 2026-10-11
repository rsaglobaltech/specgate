Feature: Two pending and one settled

  @REQ-210 @SCN-213
  Scenario: Two pending and one settled
    Given a pending transfer of 200.00 EUR, then a pending one of 50.00 EUR, and one already "completed"
    When the operator "O-001" GETs /api/transfers?status=pending
    Then the response lists the two pending transfers, the 200.00 EUR one first

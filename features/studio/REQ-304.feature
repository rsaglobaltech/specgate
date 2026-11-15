Feature: The report shows the two gaps

  @REQ-304 @SCN-304a
  Scenario: A report after two runs
    Given a project whose ledger records REQ-002, rejected at `quality check: pmd` and then passed, and REQ-003, passed at once
    When the studio's report is read
    Then it gives spec → implementation 50 % and intent → spec 0 %

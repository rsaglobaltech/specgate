Feature: One flagged row held back

  @REQ-708 @SCN-711
  Scenario: One flagged row held back
    Given a pay period with 3 approved rows and 1 row with an unresolved flag
    When an administrator exports the period as CSV
    Then the CSV has the header and 3 data rows, and the flagged row is reported as held back

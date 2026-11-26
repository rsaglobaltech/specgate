Feature: A changed acceptance test fails the gate

  @REQ-758 @SCN-758a
  Scenario: One byte
    Given export-csv with `tests/acceptance/export.spec.ts` sealed
    When one byte of the file is changed and `specgate check` runs
    Then the gate fails with `acceptance_not_sealed` naming the file

  @REQ-758 @SCN-758b
  Scenario: Approved again
    Given the same change after the edit
    When a person approves its acceptance again
    Then `acceptance_not_sealed` is gone

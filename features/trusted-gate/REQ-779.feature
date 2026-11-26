Feature: A sealed test of an archived change is still checked and guarded

  @REQ-779 @SCN-779a
  Scenario: After the archive
    Given export-csv's acceptance test sealed, and export-csv archived
    When the test is changed and `specgate check` runs, or an agent's tool asks to write it
    Then the gate fails with `acceptance_not_sealed`, and the write is refused with `acceptance_sealed`

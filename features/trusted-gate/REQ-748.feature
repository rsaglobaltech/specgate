Feature: Approving takes a person at a terminal

  @REQ-748 @SCN-748a
  Scenario: An agent's command
    Given export-csv open and not approved
    When `specgate change approve export-csv` runs with no terminal
    Then it fails with `approve_needs_person`, and export-csv has no approval

  @REQ-748 @SCN-748b
  Scenario: A person at a terminal
    Given the same change
    When a person runs `specgate change approve export-csv` at a terminal
    Then export-csv is approved

Feature: A draft carries its use cases, and every requirement names one

  @REQ-626 @SCN-626a
  Scenario: A draft opens with its use cases
    Given a brief with the module bookings
    When the Developer runs `specgate draft bookings`
    Then the change has use-cases.md with an empty `## ADDED Use Cases` table, change.yaml has `uc_range`, and DRAFTING.md shows `uc=` with the first id and a section on use-cases.md

  @REQ-626 @SCN-626b
  Scenario: A requirement with no use case
    Given the draft's REQ-002 with no `uc=`, and use-cases.md listing UC-900 with REQ-002
    When the Developer checks the draft
    Then it is not ready, with `D14_no_use_case` and `D14_use_case_mismatch`; with `uc=UC-901` it has `D14_unknown_use_case`; with `uc=UC-900` it is ready to review

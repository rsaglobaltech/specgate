Feature: Nothing is built before its approvals

  @REQ-315 @SCN-315a
  Scenario: A 1.0 change nobody approved
    Given an open layered change adding REQ-002, not approved
    When `harness run --req REQ-002` runs
    Then REQ-002 is skipped with `harness_not_approved`, no agent runs, and with `approvals: { required: never }` it is attempted

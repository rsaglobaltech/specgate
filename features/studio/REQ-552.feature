Feature: A journey chains requirements and owes a test

  @REQ-552 @SCN-552a
  Scenario: Borrow then return
    Given REQ-002 and REQ-003 `Implemented`, and a scenario tagged `@JRN-001 @REQ-002 @REQ-003` that no test mentions
    When a tool runs `specgate validate --strict --json`
    Then it fails with `journey_untested` for JRN-001, and `specgate status --json` lists JRN-001 with REQ-002 and REQ-003

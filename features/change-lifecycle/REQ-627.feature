Feature: The gate checks every requirement maps to a use case

  @REQ-627 @SCN-627a
  Scenario: Reported by default
    Given a project with the template catalog and REQ-002 with no use case
    When the Developer runs `specgate validate . --strict`
    Then it passes, and reports `use_case_missing` for REQ-002

  @REQ-627 @SCN-627b
  Scenario: Failed when set to error
    Given the same project with `use_cases: error` in .specgate/gate.yaml
    When the Developer runs `specgate validate . --strict`
    Then it fails with `use_case_missing` and `use_case_template`; with `use_cases: off` it says nothing of them

  @REQ-627 @SCN-627c
  Scenario: What the rule names
    Given a matrix with REQ-002 naming no use case, REQ-003 naming UC-077 the catalog does not have, and UC-003 no requirement delivers
    When the rule runs
    Then it names REQ-002 `use_case_missing`, REQ-003 `use_case_unknown` and UC-003 `use_case_undelivered`

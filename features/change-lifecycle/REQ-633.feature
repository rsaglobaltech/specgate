@change:use-case-specs
Feature: The gate names a use case with no specification

  @REQ-633 @SCN-633a
  Scenario: A use case with no specification
    Given the catalog's UC-002 and UC-003, and a specification for UC-002 only
    When the rule runs
    Then it names UC-003 `use_case_no_spec`, and nothing once UC-003 has one

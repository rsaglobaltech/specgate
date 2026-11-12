Feature: The brief read as a form, each field with its line

  @REQ-486 @SCN-486a
  Scenario: A module with its section and one without
    Given docs/brief.md with `modules: [orders, payments]` on line 6, a section `## Module: orders` whose first rule is on line 14, no section for payments, and a paragraph "Notes from the call" outside every module
    When `specgate propose --from-brief --form --json` runs
    Then the form gives `modules` at line 6, orders' first rule with line 14, payments with a null line and no cards, and docs/brief.md is unchanged

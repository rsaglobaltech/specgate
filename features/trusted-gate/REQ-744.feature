Feature: A delivery says the source files its change's design does not name

  @REQ-744 @SCN-744a
  Scenario: A file nobody designed
    Given draft-fees approved, its design naming src/fees.js, and the rule `scope: error`
    When a delivery adds src/export.js and the Developer runs `specgate check`
    Then the gate fails with `file_outside_design` naming src/export.js

  @REQ-744 @SCN-744b
  Scenario: A warning by default
    Given the same project with no `scope` rule
    When the Developer runs `specgate check`
    Then the gate passes with the warning `file_outside_design` naming src/export.js

  @REQ-744 @SCN-744c
  Scenario: A design that names no file
    Given draft-fees of lite rigor, its design not written
    When a delivery adds src/export.js and the Developer runs `specgate check`
    Then the gate says nothing of it

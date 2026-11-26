@change:guard-scope-and-seal-run
Feature: The guard refuses a new file the approved design does not name

  @REQ-793 @SCN-793a
  Scenario: A file nobody designed
    Given draft-fees approved, its design naming `src/fees.js`, and a test naming REQ-031
    When an agent's tool asks to write the new `src/export.js`
    Then it is refused with `file_outside_design`, naming `src/export.js` and `specgate propose`; writing `src/fees.js` is allowed

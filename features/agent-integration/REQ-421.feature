Feature: An edit to source code waits for a test that names the requirement

  @REQ-421 @SCN-421a
  Scenario: Code before its test is refused
    Given a spec-driven project with the open change `module-map` (REQ-311…REQ-318) and no test in the working tree naming any of them
    When the agent tries to write `src/core/map/scan.ts`
    Then the edit is denied with "write the test for REQ-311 first"
    And once `test/module-map.test.ts` naming REQ-311 is in the working tree, the same edit is allowed
    And an edit to `test/module-map.test.ts` itself is never denied

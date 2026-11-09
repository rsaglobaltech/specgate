Feature: The guards name the next requirement as the change's tasks order it

  @REQ-426 @SCN-426a
  Scenario: The next requirement by the tasks
    Given an open change `module-map-v2` whose delta declares REQ-311, REQ-312, REQ-313, REQ-319 and REQ-320, REQ-313 and REQ-319 Implemented
    And its `tasks.md` has "REQ-313" and "REQ-319" checked and then, unchecked, "REQ-320", "REQ-312", "REQ-311"
    When the agent tries to write `src/core/map/scan.ts` with no test in the working tree naming a requirement of the change
    Then the edit is denied with "write the test for REQ-320 first" and "a test that names any requirement of `module-map-v2`"
    And the session context says the next requirement is REQ-320

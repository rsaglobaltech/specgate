Feature: OpenCode gets the same three guards

  @REQ-422 @SCN-422a
  Scenario: OpenCode refuses code before its test
    Given the project of REQ-421's scenario with the OpenCode plugin installed
    When OpenCode's agent calls `write` on `src/core/map/scan.ts`
    Then the tool call fails with "write the test for REQ-311 first"
    And a new session's system prompt names `module-map` and REQ-311

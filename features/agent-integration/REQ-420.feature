Feature: A new session starts knowing the project is spec-driven

  @REQ-420 @SCN-420a
  Scenario: Status in a fresh session
    Given a spec-driven project with the open change `module-map` whose next requirement is REQ-312
    When the developer starts a new Claude Code session there with the plugin installed
    Then the agent's context holds "spec-driven", `module-map`, "REQ-312" and "write the test first"
    And in a folder without `spec.md` it holds nothing from specgate

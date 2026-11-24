@change:compat-evidence
Feature: The control without Specgate

  @REQ-719 @SCN-719a
  Scenario: Nothing to read
    Given a run of codex at level B
    When the agent starts
    Then the copy has no AGENTS.md, no .agents, no MCP configuration, and the gate still runs afterwards

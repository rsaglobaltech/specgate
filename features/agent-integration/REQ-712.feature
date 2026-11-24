Feature: Each level gives the tool exactly its integration

  @REQ-712 @SCN-712a
  Scenario: Rules only at L0
    Given a run of opencode at L0
    When the copy is made
    Then it has AGENTS.md, and no .agents/skills, no MCP configuration and no plugin

  @REQ-712 @SCN-712b
  Scenario: No plugin for Codex
    Given `specgate compat run --tool codex --level L3`
    When the Developer runs it
    Then runs.jsonl records codex at L3 as n/a and no agent was started

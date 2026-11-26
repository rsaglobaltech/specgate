Feature: Each level gives the tool exactly its integration

  @REQ-712 @SCN-712a
  Scenario: Rules only at L0
    Given a run of opencode at L0
    When the copy is made
    Then it has AGENTS.md, and no .agents/skills, no MCP configuration and no plugin

  @REQ-712 @SCN-712b
  Scenario: Codex's hooks at L3
    Given `specgate compat run --tool codex --level L3`
    When the Developer runs it
    Then the copy has `.codex/hooks.json`, and Codex starts with `--dangerously-bypass-hook-trust`

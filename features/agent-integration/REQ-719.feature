@change:compat-evidence
Feature: The control without Specgate

  @REQ-719 @SCN-719a
  Scenario: Nothing to read
    Given a run of codex at level B
    When the agent starts
    Then the copy has no AGENTS.md, no .agents, no MCP configuration, and the gate still runs afterwards

  @REQ-719 @SCN-719b
  Scenario: Nothing above the copy, and no CLI
    Given a run of claude at level B on a machine with `specgate` installed for every project
    When the agent looks in the folders above its copy and runs `specgate status`
    Then it finds no AGENTS.md there, and the command answers that it is not found

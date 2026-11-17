Feature: What to tell your agent, from the project

  @REQ-598 @SCN-598a
  Scenario: The prompt for a Codex project
    Given a project set up for Codex whose next step is `specgate apply REQ-000`
    When the person runs `specgate status --prompt`
    Then it prints that this project uses specgate, to read AGENTS.md, the next step, Codex's `$specgate-draft`, and the rules

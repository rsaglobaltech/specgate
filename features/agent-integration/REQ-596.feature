Feature: The project's agent, not Claude for every project

  @REQ-596 @SCN-596a
  Scenario: A Codex project, with Claude installed too
    Given a project with `.codex/`, and both Codex and Claude Code installed
    When the agent is chosen
    Then Codex is chosen

  @REQ-596 @SCN-596b
  Scenario: Codex named
    Given a project with no `agent:`
    When the person runs `specgate agents init --tool codex`
    Then `harness.config.yaml` says `agent: codex exec -s workspace-write - < {prompt_file}`

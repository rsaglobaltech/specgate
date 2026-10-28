Feature: The harness gives Claude Code permission to write

  @REQ-264 @SCN-264a
  Scenario: The documented Claude Code command
    Given the agent command `claude -p < {prompt_file} | specgate harness events --from claude`
    When the harness prepares it
    Then it runs `claude --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`, and a command that already says `--allowedTools` runs as written

  @REQ-264 @SCN-264b
  Scenario: An agent that writes nothing
    Given an agent that exits 0 and writes no file, and three attempts allowed
    When `harness run` runs the requirement
    Then it makes one attempt, and says the agent produced no files and to see `docs/agent-setup.md`

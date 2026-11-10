Feature: One command sets up the agent

  @REQ-473 @SCN-473a
  Scenario: Claude Code set up once
    Given an adopted project with no `agent` set
    When the developer runs `specgate agents init --tool claude`
    Then the Claude Code commands are installed and `specgate config get agent` answers `claude -p < {prompt_file}`

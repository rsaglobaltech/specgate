Feature: The kept Claude Code agent is seen live

  @REQ-278 @SCN-278a
  Scenario: The command status suggests
    Given a project with no agent set
    When the person runs `specgate config set agent "claude -p < {prompt_file}"`
    Then `harness.config.yaml` says `agent: "claude --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude"`

  @REQ-278 @SCN-278b
  Scenario: A command that already streams or pipes
    Given the commands `claude -p --output-format json < {prompt_file}` and `claude -p < {prompt_file} | tee agent.log`
    When each is set as the agent
    Then neither gets `stream-json` nor `specgate harness events`

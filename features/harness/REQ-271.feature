Feature: The agent is kept in harness.config.yaml

  @REQ-271 @SCN-271a
  Scenario: Setting the agent once
    Given a project with requirements to do and no `agent:` in `harness.config.yaml`
    When the person runs `status`, then `specgate config set agent "claude -p < {prompt_file}"`
    Then `status` named `specgate config set agent`, and `harness.config.yaml` says `agent: "claude --permission-mode acceptEdits -p < {prompt_file}"`

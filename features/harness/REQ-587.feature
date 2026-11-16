Feature: The project chooses the agent's environment

  @REQ-587 @SCN-587a
  Scenario: A cloud key the agent does not need
    Given `agent_env: [ANTHROPIC_API_KEY]` and a shell holding `ANTHROPIC_API_KEY` and `AWS_SECRET_ACCESS_KEY`
    When the harness runs the agent
    Then the agent has `ANTHROPIC_API_KEY`, `PATH` and `SPECGATE_REQ`, and no `AWS_SECRET_ACCESS_KEY`

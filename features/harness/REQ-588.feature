Feature: The agent in a container

  @REQ-588 @SCN-588a
  Scenario: An agent with no network and no credentials but its own
    Given `sandbox: { image: ghcr.io/acme/agent:1 }` and `agent_env: [ANTHROPIC_API_KEY]`
    When the harness runs the agent
    Then the command runs in `ghcr.io/acme/agent:1` with `--network none`, the worktree as its working directory, and `-e ANTHROPIC_API_KEY` among the variables

  @REQ-588 @SCN-588b
  Scenario: A real container
    Given Docker, an image holding the agent's CLI, `sandbox: { image: <it>, network: none }` and `agent_env: [ANTHROPIC_API_KEY]`
    When the harness runs the agent with `ANTHROPIC_API_KEY` and `AWS_SECRET_ACCESS_KEY` in its environment
    Then the agent reads its prompt, finds no network, has `ANTHROPIC_API_KEY` and `SPECGATE_REQ` but no `AWS_SECRET_ACCESS_KEY`, and writes in its worktree, at its own path, files owned by the person running the harness

Feature: The agent in a container

  @REQ-588 @SCN-588a
  Scenario: An agent with no network and no credentials but its own
    Given `sandbox: { image: ghcr.io/acme/agent:1 }` and `agent_env: [ANTHROPIC_API_KEY]`
    When the harness runs the agent
    Then the command runs in `ghcr.io/acme/agent:1` with `--network none`, the worktree as its working directory, and `-e ANTHROPIC_API_KEY` among the variables

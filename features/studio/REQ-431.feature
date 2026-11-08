Feature: The agent is chosen in the studio

  @REQ-431 @SCN-431a
  Scenario: Claude Code chosen from the studio
    Given a project with no agent configured and `claude` on the PATH
    When Claude Code is chosen in Build
    Then `harness.config.yaml` holds the Claude Code agent, and Build can start

  @REQ-431 @SCN-431b
  Scenario: A temporary folder with a space
    Given the agent `claude -p < {prompt_file}` and a prompt file under `C:\Users\Juan Perez\AppData\Local\Temp`
    When the command is built
    Then the path reaches it quoted, as one argument

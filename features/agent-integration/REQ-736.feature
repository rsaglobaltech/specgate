@change:compat-sandboxed
Feature: The agent runs inside a sandbox that holds its run and nothing else

  @REQ-736 @SCN-736a
  Scenario: Only its own folder
    Given `specgate compat run --tool opencode --level L0 --runs 1 --sandbox sbx` with a fake sbx
    When the run starts
    Then one sandbox was created whose workspace is the batch's folder, the agent's command was run through `sbx exec` in the run's folder, and its environment names PATH and HOME and none of the host's variables

  @REQ-736 @SCN-736b
  Scenario: No Specgate at B
    Given a batch at levels B and L0 with a fake sbx
    When the sandboxes are set up
    Then Specgate's tarball is installed in the sandbox of L0 and not in the sandbox of B

  @REQ-736 @SCN-736d
  Scenario: The Developer's own session, never another key
    Given `specgate compat run --tool opencode --sandbox sbx --auth-opencode` and a host with OPENCODE_API_KEY set
    When the agent is started in the sandbox
    Then the Developer's own OpenCode session file is in the sandbox's home, the agent's environment has no OPENCODE_API_KEY, and the session file is gone with the sandbox

  @REQ-736 @SCN-736c
  Scenario: Nothing left
    Given a batch that created two sandboxes
    When the batch ends
    Then both were removed, and the batch's folder is gone

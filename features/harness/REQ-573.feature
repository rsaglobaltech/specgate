Feature: An interrupted run ends what it started and keeps its work

  @REQ-573 @SCN-573a
  Scenario: Ctrl-C while the agent works
    Given a harness run whose agent ignores SIGINT and SIGTERM
    When the person presses Ctrl-C
    Then the agent is no longer running and the requirement's worktree is still registered

  @REQ-573 @SCN-573b
  Scenario: The run killed outright
    Given a harness run whose agent ignores SIGTERM
    When the run's process is killed with SIGKILL
    Then the agent is no longer running within seconds

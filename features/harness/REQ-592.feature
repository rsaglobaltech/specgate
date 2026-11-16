Feature: Nothing a command started outlives it

  @REQ-592 @SCN-592a
  Scenario: The shell ended by a signal
    Given the harness running an agent that ignores SIGTERM, through a shell
    When the shell is ended by SIGTERM
    Then the agent is no longer running when the harness goes on

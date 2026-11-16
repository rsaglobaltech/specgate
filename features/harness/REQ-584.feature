Feature: A time limit per kind of command

  @REQ-584 @SCN-584a
  Scenario: An agent's hour and the tests' five minutes
    Given `timeouts: { agent: 1800, tests: 300 }`
    When the harness runs the agent, the tests and the setup
    Then the agent may take 1800 s, the tests 300 s, and the setup the run's `--timeout`

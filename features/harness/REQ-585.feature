Feature: The run's budget, a token ceiling, and no free sessions

  @REQ-585 @SCN-585a
  Scenario: The run's ceiling reached
    Given `max_run_cost_usd: 5` and the run's sessions reporting $5.20
    When the run is about to start another requirement
    Then it starts none, naming `max_run_cost_usd` and what was reported

  @REQ-585 @SCN-585b
  Scenario: A session that reports no cost
    Given `require_known_cost: true` and an agent that reports no usage
    When the harness runs a requirement
    Then the requirement fails with `cost_unknown`

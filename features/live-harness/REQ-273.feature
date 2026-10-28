Feature: Every gate step is seen when it starts and when it ends

  @REQ-273 @SCN-273a
  Scenario: The events follow the gate as it runs
    Given a project whose quality checks are `marker` and `final`, and an agent that writes one file
    When `specgate harness run` runs it
    Then the events hold, in order, a `gate-start` then a `gate` for `validate --strict`, for `quality: marker` (runner local) and for `quality: final`, each `gate` with its `ms`, and the run's output names each step as it starts and as it ends

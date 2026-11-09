Feature: The live view names the step that is running

  @REQ-274 @SCN-274a
  Scenario: A check that has run for three minutes
    Given REQ-007's events: the agent's steps, a `gate` for `validate --strict`, and a `gate-start` for `quality: coverage` three minutes ago
    When the live model is read
    Then REQ-007 is in its gate with `quality: coverage` running since three minutes ago, and the live page draws the running step by its name

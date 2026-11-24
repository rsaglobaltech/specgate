Feature: A run checks its agents before it starts

  @REQ-691 @SCN-691a
  Scenario: The agent of ausleihe does not answer
    Given careful's agent prints "Free usage limit reached" and exits 1, and REQ-006 of ausleihe pending
    When the Developer runs `specgate harness run`
    Then the harness refuses with `harness_agent_unavailable` naming REQ-006 and "Free usage limit reached", and no worktree was created

Feature: A run ended at once, and resumable

  @REQ-583 @SCN-583a
  Scenario: Stop now while the agent works
    Given a harness run whose agent ignores SIGTERM
    When the person runs `specgate harness stop --now`
    Then the agent is no longer running, the answer says `now: true`, and the worktree is kept

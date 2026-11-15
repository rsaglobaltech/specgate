Feature: A tester and an implementer, as separate sessions

  @REQ-532 @SCN-532a
  Scenario: Two sessions, in order
    Given a project whose harness config sets `roles: [tester, implementer]` and an agent that appends `SPECGATE_ROLE` to a log outside the worktree
    When a tool runs `specgate harness run --req REQ-000`
    Then the log holds `tester` then `implementer`, and the run's attempt log names both roles

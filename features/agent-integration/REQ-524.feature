Feature: apply writes exactly the plan, and only on the base it was made on

  @REQ-524 @SCN-524a
  Scenario: Applied, then stale
    Given two plans of SCN-520a's agent on the same project
    When a tool runs `specgate agent apply <first> --json`, then `specgate agent apply <second> --json`
    Then the first writes `spec.md` with the agent's line, the plan is gone, and git has nothing staged and no new commit; the second is refused with `plan_stale` naming `spec.md`, and `spec.md` keeps what the first wrote

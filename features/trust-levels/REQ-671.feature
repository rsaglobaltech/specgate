Feature: The harness does in a module only what its level allows

  @REQ-671 @SCN-671a
  Scenario: An observed module is left to a person
    Given a project with `trust: { pagos: 1, catalogo: 3 }` and REQ-040 of pagos and REQ-050 of catalogo pending
    When the Developer runs `specgate harness run`
    Then REQ-050 runs, and REQ-040 is skipped with `trust_level`, level 1 and needing 3

  @REQ-671 @SCN-671b
  Scenario: A confined module runs one named requirement
    Given a project with `trust: { pagos: 2 }` and REQ-040 and REQ-041 of pagos pending
    When the Developer runs `specgate harness run --req REQ-040`
    Then only REQ-040 runs; and `specgate harness run --concurrency 2` skips both, needing 4

  @REQ-671 @SCN-671c
  Scenario: No merging alone
    Given a project with `trust: { catalogo: 5 }`
    When the Developer runs `specgate harness run --chain`
    Then the harness refuses with `harness_trust_chain` before any worktree

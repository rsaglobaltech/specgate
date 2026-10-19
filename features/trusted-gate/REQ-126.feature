Feature: A chain of requirements, each merged only on a green gate

  @REQ-126 @SCN-126a
  Scenario: Two requirements in a chain
    Given a clean project on branch `develop` with two pending requirements and an agent that delivers both
    When the developer runs `specgate harness run --chain`
    Then `develop` gains two merge commits in order, the second requirement's branch was cut after the first merge, and `specgate check` passes on `develop`

  @REQ-126 @SCN-126b
  Scenario: The chain stops at the first failure
    Given the same project and an agent that fails the first requirement's gate
    When the developer runs `specgate harness run --chain`
    Then `develop` is unchanged, the second requirement is reported as skipped, and the run exits 1

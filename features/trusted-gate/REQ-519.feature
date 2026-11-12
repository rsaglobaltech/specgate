Feature: Each stage says how long it took

  @REQ-519 @SCN-519a
  Scenario: A passing check
    Given a project whose test command waits a quarter of a second and passes
    When a tool runs `specgate check --json`, then `specgate check --last --json`
    Then the validate and tests stages have `ms` of at least 0 and 250, the architecture stage has `ms` null, and the last result gives the same

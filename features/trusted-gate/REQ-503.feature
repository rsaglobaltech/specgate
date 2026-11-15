Feature: Every check answer lists its stages

  @REQ-503 @SCN-503a
  Scenario: validate fails on an Approved requirement no test names
    Given a project whose REQ-001 is Approved and no test names it, with `test_cmd` set
    When a tool runs `specgate check --json`
    Then it exits 1, `ids` and `changes` are `passed` or `skipped`, `validate` is `failed` with validate's own `strict_tdd_1` finding, and `tests` is `not run` with its command

Feature: Each pending requirement has an estimate that says its basis

  @REQ-493 @SCN-493a
  Scenario: History, size, and nothing at all
    Given a ledger in which REQ-001 failed once in 90 s and REQ-000 was delivered in 60 s, REQ-000 having 3 scenario steps and REQ-002 6, and a profile `fast` declaring `cost_per_run_hint` 0.5 that ran every attempt
    When `specgate plan --json` runs, and again on the project with no ledger
    Then REQ-001's time is 90000 ms and its cost 0.5, both with basis `history`; REQ-002's time is 120000 ms and its cost 1, both with basis `size`; and with no ledger every time is `null` with basis `none`

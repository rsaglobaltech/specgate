Feature: Behaviour changed without a specification is reported

  @REQ-333 @SCN-333a
  Scenario: A quick fix without a requirement
    Given , since the base, a commit "fix totals" that changes src/billing.ts, a commit "feat(REQ-004): totals" that changes src/totals.ts, and a commit "round" that changes src/round.ts with tests/round.test.ts naming REQ-005
    When the developer runs `specgate drift --json`
    Then it exits 0 and lists only the commit "fix totals" with src/billing.ts

Feature: A dry run shows the trust skip

  @REQ-695 @SCN-695a
  Scenario: ausleihe at level 2, without --req
    Given `trust: { ausleihe: 2 }` and REQ-006 of ausleihe pending
    When the Developer runs `specgate harness run --dry-run`
    Then REQ-006 shows `skipped (trust_level)` with "needs 3", and no prompt for it

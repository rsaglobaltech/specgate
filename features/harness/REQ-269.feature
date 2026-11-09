Feature: The harness report counts each requirement once

  @REQ-269 @SCN-269a
  Scenario: A failed run, then a passing one
    Given two recorded runs of REQ-002, the first failed after 7 minutes and the second passed after 11
    When `harness report` sums them up
    Then it says 1 of 1 requirements passed, none failed, nothing spent every attempt, and 18 minutes per delivered requirement

  @REQ-269 @SCN-269b
  Scenario: A run stopped by hand
    Given a `harness run` on REQ-002 that is killed while its agent works
    When `harness report` reads the ledger
    Then the run is there, with REQ-002 reported as stopped

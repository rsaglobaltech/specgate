Feature: Real specification shapes as a regression corpus

  @REQ-119 @SCN-119a
  Scenario: The corpus stays green
    Given the corpus fixture, and `SPECGATE_CORPUS` naming a second project that passes the gate
    When the test suite runs `specgate validate --strict` on each
    Then each exits 0 and reports no error and no warning

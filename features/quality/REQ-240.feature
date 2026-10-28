Feature: The baseline runs what a check needs first

  @REQ-240 @SCN-240a
  Scenario: A scan of what a build step writes
    Given a check `prep` that writes `built.txt`, and a check `scan` with `needs: prep` that writes SARIF from `built.txt` and writes none without it
    When `specgate quality baseline --accept scan` runs on a fresh tree
    Then `prep` runs first and `scan`'s finding is recorded in the baseline

Feature: The JSON of a quality run says why a check failed

  @REQ-239 @SCN-239a
  Scenario: A check that exits 1
    Given a check whose command prints "boom" and exits 1
    When `specgate quality run --json` runs it
    Then its outcome has `ok: false` and an `output` that contains "boom"

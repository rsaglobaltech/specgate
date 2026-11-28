Feature: A requirement's run before its code is kept as its before

  @REQ-803 @SCN-803a
  Scenario: Before the code, red
    Given `bdd: required`, a `bdd_cmd` whose run for REQ-031 fails and writes `test-results/checkout/screenshot.png`
    When the Developer runs `specgate evidence before REQ-031`
    Then `.specgate/evidence/REQ-031/before/run.json` holds the command with `@REQ-031` and a non-zero exit code, and `before/artifacts/checkout/screenshot.png` exists

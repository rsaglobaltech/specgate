Feature: Business rules are numbered and each one is tested

  @REQ-539 @SCN-539a
  Scenario: One rule tested, one not
    Given REQ-001 `Implemented` with the rules BR-001 and BR-002, and a test that mentions REQ-001 and BR-001
    When a tool runs `specgate validate --strict --json`
    Then it fails with `rule_untested` for BR-002 only

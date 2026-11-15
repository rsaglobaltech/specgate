Feature: Business rules are numbered and each one is tested

  @REQ-539 @SCN-539a
  Scenario: One rule tested, one not
    Given REQ-001 `Implemented` with the rules BR-001 and BR-002, and a test that mentions REQ-001 and BR-001
    When a tool runs `specgate validate --strict --json`
    Then it fails with `rule_untested` for BR-002 only

  @REQ-539 @SCN-539b
  Scenario: A change restates a requirement with rules
    Given REQ-014 in a capability spec with the rules BR-021 and BR-022, and an open change whose MODIFIED delta restates REQ-014 with both rules
    When a tool runs `specgate validate --json`
    Then it reports no `rule_duplicate`; with a second requirement that also uses BR-021, it reports `rule_duplicate` for BR-021

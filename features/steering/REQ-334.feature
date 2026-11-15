Feature: Drift can block the merge

  @REQ-334 @SCN-334a
  Scenario: The team makes drift a gate
    Given the commit "fix totals" of SCN-333a and `drift: gate` in harness.config.yaml
    When the developer runs `specgate drift --json`
    Then it exits 1 with the error `spec_drift`

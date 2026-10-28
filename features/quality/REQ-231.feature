Feature: The architecture check gets the baseline too

  @REQ-231 @SCN-231a
  Scenario: Debt held back, a new violation caught
    Given an adopted project whose arch_cmd writes SARIF and exits 1 on lib/domain/order.js depending on infrastructure
    When `specgate check` runs, then `specgate quality baseline`, then `specgate check` again, then a new lib/domain/invoice.js depends on infrastructure too
    Then the first check fails, the baseline records one finding for arch, the second check passes, and the last fails naming lib/domain/invoice.js:1 [domain-not-to-infra]

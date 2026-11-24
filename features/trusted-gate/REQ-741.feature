@change:approved-delta
Feature: A change approved before seals existed is said to be unsealed

  @REQ-741 @SCN-741a
  Scenario: Approved by an earlier Specgate
    Given draft-pedidos approved with only `approved: 2026-11-01` in its change.yaml
    When the Developer runs `specgate check`
    Then the gate passes with the warning `approval_not_sealed` naming draft-pedidos

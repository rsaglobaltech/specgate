@change:approved-delta
Feature: The gate fails when an approved requirement changed

  @REQ-740 @SCN-740a
  Scenario: A requirement rewritten after approval
    Given draft-pedidos approved, then REQ-031's statement changed to let a shipped order be cancelled
    When the Developer runs `specgate check`
    Then the gate fails with `approved_requirement_changed` naming REQ-031 as changed, whose fix is `specgate change approve draft-pedidos`

  @REQ-740 @SCN-740b
  Scenario: A scenario loosened
    Given draft-pedidos approved, then SCN-032's THEN changed from "is not cancelled" to "is cancelled"
    When the Developer runs `specgate check`
    Then the gate fails with `approved_requirement_changed` naming REQ-031

  @REQ-740 @SCN-740c
  Scenario: Approved again
    Given the same change after its requirement was rewritten
    When the Developer runs `specgate change approve draft-pedidos` and then `specgate check`
    Then the finding is gone

  @REQ-740 @SCN-740d
  Scenario: A requirement slipped in
    Given draft-pedidos approved, then REQ-032 added to its delta
    When the Developer runs `specgate check`
    Then the gate fails with `approved_requirement_changed` naming REQ-032 as added after the approval

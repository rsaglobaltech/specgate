Feature: An open change's requirements count while it is in flight

  @REQ-109 @SCN-109a
  Scenario: Status shows the change's requirement
    Given an open change `add-dynamic-pricing` that adds REQ-002 with one scenario, and no capability spec holding REQ-002
    When the developer runs `specgate status --json`
    Then REQ-002 is listed as pending, with change `add-dynamic-pricing`
    And the capability specs and `features/` are byte-for-byte unchanged

  @REQ-109 @SCN-109b
  Scenario: Check validates the change's requirement
    Given the same change, whose scenario for REQ-002 has no THEN line
    When the developer runs `specgate check`
    Then the gate fails naming REQ-002 and the change's delta file

  @REQ-109 @SCN-109c
  Scenario: The harness delivers the change's requirement
    Given the open change with REQ-002 committed, and an agent that writes a test naming REQ-002 and SCN-002a and the code
    When the developer runs `specgate harness run --req REQ-002`
    Then the run reports 1 passed, and on the branch `harness/REQ-002` REQ-002's status in the change's delta is Implemented
    And once that branch is merged, `specgate archive add-dynamic-pricing` succeeds

@change:approved-delta
Feature: Approving a change seals each of its requirements

  @REQ-739 @SCN-739a
  Scenario: Sealed at lite rigor
    Given draft-pedidos of lite rigor with REQ-031 and nothing written in its layers
    When the Developer runs `specgate change approve draft-pedidos`
    Then approvals.json has a seal for REQ-031

  @REQ-739 @SCN-739b
  Scenario: Delivering is not changing
    Given draft-pedidos approved with REQ-031 sealed
    When `specgate apply REQ-031` writes its status in the delta
    Then REQ-031's seal still matches, and the gate says nothing of it

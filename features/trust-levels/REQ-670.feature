@change:trust-levels
Feature: Each module declares how far an agent may go in it

  @REQ-670 @SCN-670a
  Scenario: A level out of range
    Given a project whose gate.yaml has `trust: { pedidos: 6 }`
    When the Developer runs `specgate check`
    Then the gate fails with `trust_invalid` naming pedidos and 6, whose fix says the levels are 1 to 5

  @REQ-670 @SCN-670b
  Scenario: No trust declared
    Given a project whose gate.yaml has no `trust:`
    When the Developer runs `specgate check`
    Then no finding names trust, and the gate passes as it did

Feature: An operation the design names is cited by a requirement

  @REQ-381 @SCN-381a
  Scenario: An operation named only in the design
    Given a layered change whose design.md names `api=contracts/fleet.yaml#listFleet` and the scaffold's `depends=contracts:REQ-NNN` and `api=<file>#<operationId>`
    When `specgate change validate` runs
    Then it warns once, for api=contracts/fleet.yaml#listFleet

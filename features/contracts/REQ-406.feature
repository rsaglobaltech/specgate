Feature: A part that waits for the contracts cites their operation

  @REQ-406 @SCN-406a
  Scenario: Tracking names the requirement, not the operation
    Given contracts' REQ-002 cites `api=contracts/fleet.openapi.yaml#getFleetStatus`, and tracking's REQ-002 has `depends=contracts:REQ-002` and no `api=`
    When the developer runs `specgate change validate track-fleet --json` in tracking
    Then it fails with `layer_no_operation_cited` naming `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`; with that `api=` in the trace it does not

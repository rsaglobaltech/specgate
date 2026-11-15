Feature: A part cites the operation as the story lists it

  @REQ-415 @SCN-415a
  Scenario: Web cites a contract file that does not exist
    Given contracts has `contracts/tracking-api.yaml` with `listFleetPositions`, cited by its REQ-002, and tracking's REQ-002 cites `api=contracts:contracts/tracking.yaml#listFleetPositions`
    When the developer runs `specgate change validate track-fleet --json` and `specgate change approve track-fleet` in tracking
    Then validate fails with `layer_api_unresolved` naming `contracts/tracking.yaml` and listing `api=contracts:contracts/tracking-api.yaml#listFleetPositions`, approve is refused, and with that line in the trace validate reports nothing

  @REQ-415 @SCN-415b
  Scenario: Tracking cites the requirement and not its operation
    Given contracts' REQ-002 cites `api=contracts/tracking-api.yaml#listFleetPositions`, and tracking's REQ-002 has `depends=contracts:REQ-002` and no `api=`
    When the story's context is built for tracking, and the developer runs `specgate change validate` and `specgate change approve` there
    Then the context lists `depends=contracts:REQ-002 api=contracts:contracts/tracking-api.yaml#listFleetPositions` with `GET /fleet/positions`, validate fails with `layer_no_operation_cited`, and approve is refused

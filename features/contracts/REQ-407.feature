Feature: The prompt quotes the operation

  @REQ-407 @SCN-407a
  Scenario: Tracking's agent reads getFleetStatus
    Given tracking's REQ-002 cites `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus` in an open change of the story
    When the harness builds REQ-002's prompt in tracking
    Then the prompt names `GET /fleet/status (getFleetStatus)`, quotes the operation's `operationId: getFleetStatus` line, and says to serve or call exactly that path

Feature: An operation of another repository's contract

  @REQ-405 @SCN-405a
  Scenario: Tracking cites the contracts' operation
    Given contracts has `contracts/fleet.openapi.yaml` with `GET /fleet/status` (`getFleetStatus`), and tracking's REQ-002 is Implemented with `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`
    When the developer runs `specgate validate` in tracking and `specgate workspace check --json` in the workspace
    Then validate reports no `api_contract_missing`; the check reports no `workspace_api_unresolved`, and fails with it once the citation names `#getNothing`

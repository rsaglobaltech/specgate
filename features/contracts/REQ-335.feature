Feature: A requirement points at an API operation

  @REQ-335 @SCN-335a
  Scenario: The operation exists
    Given openapi.yaml has `POST /positions` with operationId `reportPosition`, and REQ-002 says `api=openapi.yaml#/paths/~1positions/post`
    When the developer runs `specgate validate . --strict`
    Then it passes

  @REQ-335 @SCN-335b
  Scenario: The operation is not in the contract
    Given REQ-002, delivered, says `api=reportSpeed` and no contract has that operationId
    When the developer runs `specgate validate . --strict --json`
    Then it fails with `api_operation_missing` naming REQ-002 and reportSpeed

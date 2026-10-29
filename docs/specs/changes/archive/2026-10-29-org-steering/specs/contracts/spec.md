# Delta — contracts

## Purpose

Interface contracts — OpenAPI and AsyncAPI — as specifications the
requirements point at, and checked against them.

## ADDED Requirements

### Requirement: REQ-335 — A requirement points at an API operation

The system SHALL validate each `api=` reference in a requirement's specgate:trace — `<contract>#<JSON pointer>` such as `openapi.yaml#/paths/~1positions/post`, `<contract>#<operationId>`, or an operationId found in one of the project's contracts — against the OpenAPI or AsyncAPI contract, in YAML or JSON, and SHALL fail `validate` with `api_operation_missing` when the operation is not in it, or `api_contract_missing` when the file does not exist.

#### Scenario: SCN-335a — The operation exists

- GIVEN openapi.yaml has `POST /positions` with operationId `reportPosition`, and REQ-002 says `api=openapi.yaml#/paths/~1positions/post`
- WHEN the developer runs `specgate validate . --strict`
- THEN it passes

#### Scenario: SCN-335b — The operation is not in the contract

- GIVEN REQ-002 says `api=reportSpeed` and no contract has that operationId
- WHEN the developer runs `specgate validate . --strict --json`
- THEN it fails with `api_operation_missing` naming REQ-002 and reportSpeed

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->

### Requirement: REQ-336 — One command compares contracts and requirements

The system SHALL compare, with `specgate contract check`, each contract of the project with the requirements that cite it: each operation no requirement cites as a warning, and each requirement citing an operation the contract lacks as an error that exits 1.

#### Scenario: SCN-336a — One operation without a requirement

- GIVEN openapi.yaml has `POST /positions` and `GET /positions/{id}`, and only REQ-002 cites `reportPosition`
- WHEN the developer runs `specgate contract check --json`
- THEN it exits 0 and names `GET /positions/{id}` as not cited by any requirement

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->

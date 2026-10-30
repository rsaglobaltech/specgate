# Delta — contracts

## ADDED Requirements

### Requirement: REQ-385 — A contract is written one requirement at a time

The system SHALL hold a requirement's `api=` citation to a contract and an operation that exist only once the requirement is delivered (Implemented, Verified or Released, by its trace or its matrix row) or is the one `validate --delivering` names; for any other requirement a citation that does not resolve SHALL be a warning with the same code, `api_contract_missing` or `api_operation_missing`, saying it must resolve once the requirement is delivered, and `validate` SHALL pass on it.

#### Scenario: SCN-385a — The contracts repository delivers its first operation

- GIVEN openapi.yaml has `reportPosition`, REQ-001 cites it, and REQ-002 and REQ-003, still Draft, cite asyncapi.yaml, not written yet
- WHEN the developer runs `specgate validate . --strict --json`
- THEN it passes with two `api_contract_missing` warnings saying they must resolve once delivered, and delivering REQ-002 holds REQ-002's citation as an error

#### Scenario: SCN-385b — Delivered, its contract still missing

- GIVEN REQ-002 is Implemented and cites asyncapi.yaml, which does not exist
- WHEN the developer runs `specgate validate . --strict --json`
- THEN it fails with `api_contract_missing` as an error for REQ-002

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/org-steering.test.ts -->

## MODIFIED Requirements

### Requirement: REQ-335 — A requirement points at an API operation

The system SHALL validate each `api=` reference in a requirement's specgate:trace — `<contract>#<JSON pointer>` such as `openapi.yaml#/paths/~1positions/post`, `<contract>#<operationId>`, or an operationId found in one of the project's contracts — against the OpenAPI or AsyncAPI contract, in YAML or JSON, and SHALL fail `validate` with `api_operation_missing` when the operation is not in it, or `api_contract_missing` when the file does not exist, for a requirement that is delivered or being delivered (REQ-385).

#### Scenario: SCN-335a — The operation exists

- GIVEN openapi.yaml has `POST /positions` with operationId `reportPosition`, and REQ-002 says `api=openapi.yaml#/paths/~1positions/post`
- WHEN the developer runs `specgate validate . --strict`
- THEN it passes

#### Scenario: SCN-335b — The operation is not in the contract

- GIVEN REQ-002, delivered, says `api=reportSpeed` and no contract has that operationId
- WHEN the developer runs `specgate validate . --strict --json`
- THEN it fails with `api_operation_missing` naming REQ-002 and reportSpeed

<!-- specgate:trace actor=Developer feature=features/contracts/REQ-335.feature kind=functional status=Implemented test=tests/unit/org-steering.test.ts -->

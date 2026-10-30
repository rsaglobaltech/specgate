# Contracts

## Purpose

Interface contracts — OpenAPI and AsyncAPI — as specifications the
requirements point at, and checked against them.

## Requirements

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

### Requirement: REQ-336 — One command compares contracts and requirements

The system SHALL compare, with `specgate contract check`, each contract of the project with the requirements that cite it: each operation no requirement cites as a warning, and each requirement citing an operation the contract lacks as an error that exits 1.

#### Scenario: SCN-336a — One operation without a requirement

- GIVEN openapi.yaml has `POST /positions` and `GET /positions/{id}`, and only REQ-002 cites `reportPosition`
- WHEN the developer runs `specgate contract check --json`
- THEN it exits 0 and names `GET /positions/{id}` as not cited by any requirement

<!-- specgate:trace actor=Developer feature=features/contracts/REQ-336.feature kind=functional status=Implemented test=tests/unit/org-steering.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/contracts/REQ-385.feature kind=functional status=Implemented test=tests/unit/org-steering.test.ts -->

### Requirement: REQ-405 — An operation of another repository's contract

The system SHALL read `api=<repo>:<file>#<operationId>` in a requirement's trace as an operation of the contract `<file>` of the workspace repository `<repo>`; a member's `validate` SHALL leave it to the workspace, and `workspace check` SHALL resolve it in that repository's contracts, failing with `workspace_api_unresolved` for a delivered requirement and warning with it otherwise, and failing with `workspace_unknown_repo` when the workspace has no repository by that name.

#### Scenario: SCN-405a — Tracking cites the contracts' operation

- GIVEN contracts has `contracts/fleet.openapi.yaml` with `GET /fleet/status` (`getFleetStatus`), and tracking's REQ-002 is Implemented with `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`
- WHEN the developer runs `specgate validate` in tracking and `specgate workspace check --json` in the workspace
- THEN validate reports no `api_contract_missing`; the check reports no `workspace_api_unresolved`, and fails with it once the citation names `#getNothing`

<!-- specgate:trace actor=Developer feature=features/contracts/REQ-405.feature kind=functional status=Implemented test=tests/unit/rc9-contract.test.ts -->

### Requirement: REQ-406 — A part that waits for the contracts cites their operation

The system SHALL warn `layer_no_operation_cited` in `change validate` for a requirement of a story's sub-change, outside the contracts repository, whose `depends=` names a requirement of a contracts repository it shares a criterion with and whose trace has no `api=`, naming the `api=` citations of that requirement qualified with its repository; the story's context and the design's guidance SHALL ask for `api=<contracts>:contracts/<file>#<operationId>` and say the provider serves and the consumer calls exactly that method and path.

#### Scenario: SCN-406a — Tracking names the requirement, not the operation

- GIVEN contracts' REQ-002 cites `api=contracts/fleet.openapi.yaml#getFleetStatus`, and tracking's REQ-002 has `depends=contracts:REQ-002` and no `api=`
- WHEN the developer runs `specgate change validate track-fleet --json` in tracking
- THEN it warns `layer_no_operation_cited` naming `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`; with that `api=` in the trace it does not

<!-- specgate:trace actor=Developer feature=features/contracts/REQ-406.feature kind=functional status=Implemented test=tests/unit/rc9-contract.test.ts -->

### Requirement: REQ-407 — The prompt quotes the operation

The system SHALL add to the harness prompt of a requirement whose trace carries `api=` a section naming each operation it cites — method and path, operationId, contract — with the operation's text as the contract writes it, and the rule that the provider serves and the consumer calls exactly that method and path; an operation of another repository's contract SHALL be found through the workspace that `workspace harness run` names, or the `story.json` of an open change.

#### Scenario: SCN-407a — Tracking's agent reads getFleetStatus

- GIVEN tracking's REQ-002 cites `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus` in an open change of the story
- WHEN the harness builds REQ-002's prompt in tracking
- THEN the prompt names `GET /fleet/status (getFleetStatus)`, quotes the operation's `operationId: getFleetStatus` line, and says to serve or call exactly that path

<!-- specgate:trace actor=Developer feature=features/contracts/REQ-407.feature kind=functional status=Implemented test=tests/unit/rc9-contract.test.ts -->

### Requirement: REQ-408 — The operation is in the code

The system SHALL warn `contract_operation_not_found`, in `workspace check` and in `contract check`, for each delivered requirement citing an OpenAPI operation whose path appears in no source file of its repository — tests, `contracts/`, `docs/` and `features/` excluded — where a `{param}` of the path matches `{x}`, `:x`, `[x]`, `<x>`, `${…}` or `*` and anything may come before the path, naming the requirement, the method and the path.

#### Scenario: SCN-408a — Tracking serves a path of its own

- GIVEN tracking's REQ-002, Implemented, cites the contract's tachograph operation `getTachograph`, whose path has a vehicle parameter
- WHEN tracking's code serves that path under `/api` with `:vehicleId`, and then only a path of its own under `/api/fleet/trucks`
- THEN `workspace check` warns nothing about it the first time, and `contract_operation_not_found` naming tracking:REQ-002 and the operation's method and path the second

<!-- specgate:trace actor=Developer feature=features/contracts/REQ-408.feature kind=functional status=Implemented test=tests/unit/rc9-contract.test.ts -->

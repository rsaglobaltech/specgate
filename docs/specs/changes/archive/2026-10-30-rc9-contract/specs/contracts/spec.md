# Delta — contracts

## ADDED Requirements

### Requirement: REQ-405 — An operation of another repository's contract

The system SHALL read `api=<repo>:<file>#<operationId>` in a requirement's trace as an operation of the contract `<file>` of the workspace repository `<repo>`; a member's `validate` SHALL leave it to the workspace, and `workspace check` SHALL resolve it in that repository's contracts, failing with `workspace_api_unresolved` for a delivered requirement and warning with it otherwise, and failing with `workspace_unknown_repo` when the workspace has no repository by that name.

#### Scenario: SCN-405a — Tracking cites the contracts' operation

- GIVEN contracts has `contracts/fleet.openapi.yaml` with `GET /fleet/status` (`getFleetStatus`), and tracking's REQ-002 is Implemented with `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`
- WHEN the developer runs `specgate validate` in tracking and `specgate workspace check --json` in the workspace
- THEN validate reports no `api_contract_missing`; the check reports no `workspace_api_unresolved`, and fails with it once the citation names `#getNothing`

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/contracts/REQ-405.feature test=tests/unit/rc9-contract.test.ts -->

### Requirement: REQ-406 — A part that waits for the contracts cites their operation

The system SHALL warn `layer_no_operation_cited` in `change validate` for a requirement of a story's sub-change, outside the contracts repository, whose `depends=` names a requirement of a contracts repository it shares a criterion with and whose trace has no `api=`, naming the `api=` citations of that requirement qualified with its repository; the story's context and the design's guidance SHALL ask for `api=<contracts>:contracts/<file>#<operationId>` and say the provider serves and the consumer calls exactly that method and path.

#### Scenario: SCN-406a — Tracking names the requirement, not the operation

- GIVEN contracts' REQ-002 cites `api=contracts/fleet.openapi.yaml#getFleetStatus`, and tracking's REQ-002 has `depends=contracts:REQ-002` and no `api=`
- WHEN the developer runs `specgate change validate track-fleet --json` in tracking
- THEN it warns `layer_no_operation_cited` naming `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`; with that `api=` in the trace it does not

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/contracts/REQ-406.feature test=tests/unit/rc9-contract.test.ts -->

### Requirement: REQ-407 — The prompt quotes the operation

The system SHALL add to the harness prompt of a requirement whose trace carries `api=` a section naming each operation it cites — method and path, operationId, contract — with the operation's text as the contract writes it, and the rule that the provider serves and the consumer calls exactly that method and path; an operation of another repository's contract SHALL be found through the workspace that `workspace harness run` names, or the `story.json` of an open change.

#### Scenario: SCN-407a — Tracking's agent reads getFleetStatus

- GIVEN tracking's REQ-002 cites `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus` in an open change of the story
- WHEN the harness builds REQ-002's prompt in tracking
- THEN the prompt names `GET /fleet/status (getFleetStatus)`, quotes the operation's `operationId: getFleetStatus` line, and says to serve or call exactly that path

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/contracts/REQ-407.feature test=tests/unit/rc9-contract.test.ts -->

### Requirement: REQ-408 — The operation is in the code

The system SHALL warn `contract_operation_not_found`, in `workspace check` and in `contract check`, for each delivered requirement citing an OpenAPI operation whose path appears in no source file of its repository — tests, `contracts/`, `docs/` and `features/` excluded — where a `{param}` of the path matches `{x}`, `:x`, `[x]`, `<x>`, `${…}` or `*` and anything may come before the path, naming the requirement, the method and the path.

#### Scenario: SCN-408a — Tracking serves a path of its own

- GIVEN tracking's REQ-002, Implemented, cites the contract's tachograph operation `getTachograph`, whose path has a vehicle parameter
- WHEN tracking's code serves that path under `/api` with `:vehicleId`, and then only a path of its own under `/api/fleet/trucks`
- THEN `workspace check` warns nothing about it the first time, and `contract_operation_not_found` naming tracking:REQ-002 and the operation's method and path the second

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/contracts/REQ-408.feature test=tests/unit/rc9-contract.test.ts -->

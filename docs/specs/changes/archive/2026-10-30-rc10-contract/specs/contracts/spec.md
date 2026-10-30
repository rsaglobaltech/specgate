# Delta — contracts

## ADDED Requirements

### Requirement: REQ-415 — A part cites the operation as the story lists it

The system SHALL list in a story's context, under each requirement of a contracts repository's part, the `depends=<repo>:REQ-NNN api=<repo>:<file>#<operationId>` line of each operation it cites, with the operation's method and path, and say to copy it exactly; `change validate` SHALL fail with `layer_api_unresolved` for a requirement of another part whose `api=` names a shared contracts repository and resolves to none of its operations, listing that repository's operations as `api=` lines, while that repository has a contract, and warn with it before; and `change approve` SHALL refuse such a part.

#### Scenario: SCN-415a — Web cites a contract file that does not exist

- GIVEN contracts has `contracts/tracking-api.yaml` with `listFleetPositions`, cited by its REQ-002, and tracking's REQ-002 cites `api=contracts:contracts/tracking.yaml#listFleetPositions`
- WHEN the developer runs `specgate change validate track-fleet --json` and `specgate change approve track-fleet` in tracking
- THEN validate fails with `layer_api_unresolved` naming `contracts/tracking.yaml` and listing `api=contracts:contracts/tracking-api.yaml#listFleetPositions`, approve is refused, and with that line in the trace validate reports nothing

#### Scenario: SCN-415b — Tracking cites the requirement and not its operation

- GIVEN contracts' REQ-002 cites `api=contracts/tracking-api.yaml#listFleetPositions`, and tracking's REQ-002 has `depends=contracts:REQ-002` and no `api=`
- WHEN the story's context is built for tracking, and the developer runs `specgate change validate` and `specgate change approve` there
- THEN the context lists `depends=contracts:REQ-002 api=contracts:contracts/tracking-api.yaml#listFleetPositions` with `GET /fleet/positions`, validate fails with `layer_no_operation_cited`, and approve is refused

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/contracts/REQ-415.feature test=tests/unit/rc10-contract.test.ts -->

### Requirement: REQ-418 — The code serves or calls the operation it cites

The system SHALL fail a harness attempt whose gate passed when the requirement cites an operation of another repository's contract (`api=<repo>:<file>#<operationId>`) and no source file of the worktree — tests, `contracts/`, `docs/` and `features/` excluded — has its path, whole as `contract_operation_not_found` matches it or in pieces with every literal segment in a quoted string of one file, and SHALL give the next attempt the method and path to serve or call.

#### Scenario: SCN-418a — Tracking passes its tests and serves no route of the contract

- GIVEN tracking's REQ-002 cites `api=contracts:contracts/tracking-api.yaml#getTruckStatus`, whose path has a truck parameter
- WHEN tracking's controller serves no such path; then serves the operation's path whole; then splits it, a prefix on the class and the rest on the method; then drops its last segment
- THEN the check names `contract_operation_not_found` and the operation's method and path the first and last time, and nothing the second and third; the contracts repository, citing its own operations, is not checked

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/contracts/REQ-418.feature test=tests/unit/rc10-contract.test.ts -->

## MODIFIED Requirements

### Requirement: REQ-406 — A part that waits for the contracts cites their operation

The system SHALL report `layer_no_operation_cited` in `change validate` for a requirement of a story's sub-change, outside the contracts repository, whose `depends=` names a requirement of a contracts repository it shares a criterion with and whose trace has no `api=`, naming the `api=` citations of that requirement qualified with its repository — an error when that requirement cites an operation, which `change approve` refuses, and a warning when it cites none; the story's context and the design's guidance SHALL ask for `api=<contracts>:contracts/<file>#<operationId>` and say the provider serves and the consumer calls exactly that method and path.

#### Scenario: SCN-406a — Tracking names the requirement, not the operation

- GIVEN contracts' REQ-002 cites `api=contracts/fleet.openapi.yaml#getFleetStatus`, and tracking's REQ-002 has `depends=contracts:REQ-002` and no `api=`
- WHEN the developer runs `specgate change validate track-fleet --json` in tracking
- THEN it fails with `layer_no_operation_cited` naming `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`; with that `api=` in the trace it does not

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/contracts/REQ-406.feature test=tests/unit/rc9-contract.test.ts -->

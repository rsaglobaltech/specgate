# Delta — workspace

## ADDED Requirements

### Requirement: REQ-386 — A part that shares a criterion with the contracts cites them

The system SHALL warn, with `layer_no_contract_cited` on `change validate`, for each requirement of a story's sub-change in a repository that is not the contracts repository and shares a criterion of the story with it, when the requirement's trace carries neither `depends=<contracts>:REQ-NNN` nor an `api=` citation; a story that maps no criteria to repositories shares them all, and the contracts repository is not asked to cite itself.

#### Scenario: SCN-386a — The tracking part cites nothing of the contracts

- GIVEN the story track-fleet gives AC-1 to contracts and to tracking, and tracking's REQ-002 cites nothing
- WHEN the developer runs `specgate change validate track-fleet --json` in tracking
- THEN it warns `layer_no_contract_cited` for REQ-002, with a fix naming `depends=contracts:REQ-NNN`, and no longer once the trace carries `depends=contracts:REQ-002` or an `api=`

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc4-deps.test.ts -->

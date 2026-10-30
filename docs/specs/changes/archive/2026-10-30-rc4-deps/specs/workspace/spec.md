# Delta — workspace

## ADDED Requirements

### Requirement: REQ-382 — The contracts repository writes its contracts, and the others cite them

The system SHALL tell whoever writes a part of a story in the repository whose role is `contracts` to write the OpenAPI or AsyncAPI file its requirements describe under `contracts/` and to cite each operation in its requirement's trace as `api=contracts/<file>#<operationId>`, and SHALL tell whoever writes a part in another repository to cite the contracts repository's requirements it uses with `depends=<contracts>:REQ-NNN` and their operations with `api=` once the contract file exists.

#### Scenario: SCN-382a — Writing the contracts part, then the panel's

- GIVEN a story across fleet, tracking and contracts, its sub-changes opened
- WHEN `change author --artifact specs` is prepared in contracts, and then in tracking
- THEN the contracts prompt asks for the contract file under contracts/ and `api=contracts/`, and the tracking prompt asks to cite `depends=contracts:REQ-NNN`

<!-- specgate:trace actor=Architect kind=functional status=Implemented test=tests/unit/rc4-deps.test.ts -->

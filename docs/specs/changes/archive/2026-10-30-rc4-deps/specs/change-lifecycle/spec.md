# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-380 — A dependency the design names is carried by a requirement

The system SHALL warn, when a layered change is validated, `layer_design_dependency_untraced` for each `depends=<repo>:REQ-NNN` that design.md names and that no `specgate:trace` of the change's delta carries, naming the requirement the design line associates it with when it names one, and saying to add it to that requirement's trace.

#### Scenario: SCN-380a — The panel's design names what it waits for

- GIVEN a layered change whose design.md has the row "REQ-002 — `depends=tracking:REQ-002`" and whose REQ-002 trace carries no depends
- WHEN `specgate change validate` runs
- THEN it warns layer_design_dependency_untraced for tracking:REQ-002, naming REQ-002

#### Scenario: SCN-380b — The dependency is in the trace

- GIVEN the same change, with `depends=tracking:REQ-002` in REQ-002's trace
- WHEN `specgate change validate` runs
- THEN it gives no layer_design_dependency_untraced warning

<!-- specgate:trace actor=Architect kind=functional status=Implemented test=tests/unit/rc4-deps.test.ts -->

### Requirement: REQ-381 — An operation the design names is cited by a requirement

The system SHALL warn `layer_design_dependency_untraced` for each `api=<file>#<operation>` that design.md names and that no trace of the change's delta cites, and SHALL take neither a placeholder id (`REQ-NNN`) nor a placeholder file (`<file>`) for a reference.

#### Scenario: SCN-381a — An operation named only in the design

- GIVEN a layered change whose design.md names `api=contracts/fleet.yaml#listFleet` and the scaffold's `depends=contracts:REQ-NNN` and `api=<file>#<operationId>`
- WHEN `specgate change validate` runs
- THEN it warns once, for api=contracts/fleet.yaml#listFleet

<!-- specgate:trace actor=Architect kind=functional status=Implemented test=tests/unit/rc4-deps.test.ts -->

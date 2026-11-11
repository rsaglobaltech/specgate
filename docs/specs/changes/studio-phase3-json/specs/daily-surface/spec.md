# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-498 — The matrix answers one row per scenario

The system SHALL list in `specgate matrix --json` and the API's `matrix(dir)`, as `matrix.scenarios`, one row per scenario of the traceability matrix, derived or kept by hand, with the requirements of the open changes as `status` counts them — a requirement with no scenario as one row whose `scenario` is null — each with `requirement`, `scenario`, `feature`, `tests` (the test files it names), `code` (the code files it names), `status`, `gaps` (which of `feature`, `test` and `code` the row does not link to a file that exists) and `waiting` (the open question that blocks its requirement, with its change, or null); and SHALL keep `matrix.rows` as the number of rows.

#### Scenario: SCN-498a — Two scenarios, one with its test and code, one without

- GIVEN a derived project whose REQ-001 has the scenarios SCN-001a and SCN-001b in `features/orders/REQ-001.feature`, a test that names REQ-001 and code that names REQ-001, and whose REQ-002 has a feature and no test or code
- WHEN a tool runs `specgate matrix --json --dry-run` and calls `matrix(dir)`
- THEN both list a row for SCN-001a and one for SCN-001b with the feature, the test and the code and no gap, and a row for REQ-002 whose `gaps` are `test` and `code`

#### Scenario: SCN-498b — Q2 blocks REQ-002

- GIVEN that project with the open change `draft-orders`, whose open question Q2 blocks REQ-002
- WHEN a tool runs `specgate matrix --json --dry-run`
- THEN REQ-002's row has `waiting` with `question` Q2 and `change` `draft-orders`, and REQ-001's rows have `waiting` null

<!-- specgate:trace status=Approved actor=Developer kind=functional -->

### Requirement: REQ-500 — status names each requirement's capability

The system SHALL give each requirement of `specgate status --json` and the API's `status(dir)` its `capability`: the folder of the capability spec that states it under `docs/specs/capabilities/`, or of the delta of the open change that adds it, and null for a requirement stated only in `spec.md`.

#### Scenario: SCN-500a — An archived requirement, an open one and one in spec.md

- GIVEN a project whose REQ-001 is in `spec.md`, REQ-002 in `docs/specs/capabilities/orders/spec.md`, and REQ-003 in the delta `specs/billing/spec.md` of an open change
- WHEN a tool runs `specgate status --json`
- THEN REQ-001 has `capability` null, REQ-002 has `orders` and REQ-003 has `billing`

<!-- specgate:trace status=Approved actor=Developer kind=functional -->

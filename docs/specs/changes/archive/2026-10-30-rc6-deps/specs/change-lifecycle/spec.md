# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-390 — The design carries its dependencies into the traces

The system SHALL include, among the rules of `change instructions design` for a layered change (and so in the prompt of `change author design`), a rule saying that a `depends=<repo>:REQ-NNN` or `api=<file>#<operationId>` the design decides goes into that requirement's `specgate:trace` in the delta under `specs/`, naming `layer_design_dependency_untraced`.

#### Scenario: SCN-390a — The architect is told to carry a dependency into the trace

- GIVEN a layered change panel
- WHEN the architect runs `specgate change instructions design panel --json`
- THEN one of the rules names `depends=`, `api=`, the `specgate:trace` under `specs/` and `layer_design_dependency_untraced`

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/change-lifecycle/REQ-390.feature test=tests/unit/rc6-deps.test.ts -->

### Requirement: REQ-391 — A placeholder operation is no citation

The system SHALL NOT report `layer_design_dependency_untraced` for an `api=<file>#<operationId>` whose operation is a placeholder in angle brackets, even when the file is named.

#### Scenario: SCN-391a — An operation placeholder after a real file is no reference

- GIVEN the design of panel quotes `api=contracts/fleet-tracking.openapi.yaml#<operationId>`
- WHEN the developer runs `specgate change validate panel --json`
- THEN no `layer_design_dependency_untraced` is reported

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/change-lifecycle/REQ-391.feature test=tests/unit/rc6-deps.test.ts -->

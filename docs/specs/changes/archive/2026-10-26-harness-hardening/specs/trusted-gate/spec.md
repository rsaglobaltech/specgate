# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-183 — The gate fills the test command's placeholders outside the harness

The system SHALL run the test command of `specgate check` with `{req}`, `{scenario}` and `{feature_file}` empty, as the gate of the whole project, and the one of `apply` and `done` for a single requirement with `{req}` set to it; several requirements at once run it with `{req}` empty.

#### Scenario: SCN-183a — check runs it for the whole project

- GIVEN the test command `npm test && node e2e-names.mjs {req} {scenario} {feature_file}`
- WHEN `specgate check` plans its gate
- THEN it runs `npm test && node e2e-names.mjs`

#### Scenario: SCN-183b — done and apply run it for their requirement

- GIVEN the test command `npm test && node e2e-names.mjs {req}`
- WHEN REQ-007 is delivered
- THEN the gate runs `npm test && node e2e-names.mjs REQ-007`

<!-- specgate:trace status=Implemented test=packages/core/test/unit/done-verification.test.ts actor=Developer kind=functional -->

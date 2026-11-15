# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-570 — Every release's project keeps working

The system SHALL keep, under `tests/compat/<version>/`, a project as each release since 0.35.0 wrote it, and its test suite SHALL read each one with the CLI being built — `validate`, `status --json`, `config list`, `change validate` of each open change — and, for a project from before 1.0, run `migrate 1.0` and then `validate --strict`, failing when any of them fails.

#### Scenario: SCN-570a — A project 0.35.0 wrote

- GIVEN the project 0.35.0 wrote with `init --yes` and `propose pdf-invoices`, its lanes under `roles:`
- WHEN the test suite runs
- THEN it validates as it is, status names the migration, `migrate 1.0` succeeds, and it passes `validate --strict`, `config list` and `change validate` afterwards

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-570.feature actor=Maintainer kind=functional -->

### Requirement: REQ-571 — A version is checked against the surface before it is published

The system SHALL, in the npm publish job and before publishing, run `contract:check --release <version>`, so that a version adding to the public surface without raising at least the minor, or removing from it outside a new major, is not published; while the frozen surface is a candidate's or a 0.x one, the diff SHALL be reported without stopping the release.

#### Scenario: SCN-571a — The publish job checks the version

- GIVEN the publish workflow
- WHEN it runs for a tag
- THEN it runs `contract:check --release` with the version, after the test suite and before publishing

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-571.feature actor=Maintainer kind=functional -->

### Requirement: REQ-572 — A published version is installed and used

The system SHALL, after publishing a version to npm, install it from the registry as a user would — once the registry serves it — check that the dist-tag it was meant for names it, and run `specgate --version`, `sgate --version`, `specgate init --yes` and `specgate status --json` with it, failing the workflow when any of them fails.

#### Scenario: SCN-572a — The published package, installed

- GIVEN the publish workflow
- WHEN a version is published
- THEN a job after it installs that version from npm, checks its dist-tag, and runs `--version`, `init` and `status`

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-572.feature actor=Maintainer kind=functional -->

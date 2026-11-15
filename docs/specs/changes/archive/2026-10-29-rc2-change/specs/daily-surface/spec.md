# Delta — daily-surface

## MODIFIED Requirements

### Requirement: REQ-249 — init --yes where code exists adopts it

The system SHALL, when `specgate init --yes` runs in a folder that already has code, adopt that folder in place as plain `specgate init` does, and scaffold a separate project there only with `--new` (or `--out`, `--config`, `--multi-stack`, `--forja`, which describe the project to create).

#### Scenario: SCN-249a — A package.json and --yes

- GIVEN a folder with `package.json`
- WHEN `specgate init --yes --dry-run` runs
- THEN it says it adopts the folder in place and writes no sub-folder project

#### Scenario: SCN-249b — --new still scaffolds

- GIVEN a folder with `package.json`
- WHEN `specgate init --yes --new --dry-run` runs
- THEN it scaffolds a separate project, as before

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-249.feature kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

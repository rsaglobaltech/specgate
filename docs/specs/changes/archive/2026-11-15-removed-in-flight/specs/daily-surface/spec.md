# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-557 — A requirement an open change removes owes nothing to validate

The system SHALL, in `specgate validate`, judge a requirement that an open change's delta lists under `## REMOVED Requirements` as it judges a `Deprecated` one — its feature file, technical artifact and test may be gone, and no strict-TDD rule applies to it — so that the tree `specgate check` passes while the change is open, with those files deleted, also passes `specgate validate --strict`.

#### Scenario: SCN-557a — Removing a delivered requirement

- GIVEN a delivered requirement with a feature file and a test, and an open change that removes it
- WHEN its feature file and its test are deleted, and a developer runs `specgate validate . --strict`
- THEN it passes, with no `declared_artifact_missing` and no strict-TDD violation for that requirement

<!-- specgate:trace status=Implemented feature=features/daily-surface/REQ-557.feature actor=Developer kind=functional -->

### Requirement: REQ-558 — The after-archive copy keeps a symlink

The system SHALL, when it copies the project to judge it after archive (`check`, `apply`, `status`), recreate each symlink git lists as a symlink to the same target, instead of copying what it points at, so a linked folder such as `node_modules` never stops the command.

#### Scenario: SCN-558a — A linked node_modules

- GIVEN a project in git with an open change and an untracked symlink `node_modules` pointing at a folder
- WHEN a developer runs `specgate check`
- THEN the gate runs, and does not fail copying the symlink

<!-- specgate:trace status=Implemented feature=features/daily-surface/REQ-558.feature actor=Developer kind=functional -->

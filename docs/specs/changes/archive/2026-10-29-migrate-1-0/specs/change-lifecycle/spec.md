# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-325 — A 0.27 change in progress is upgraded to the three layers

The system SHALL, on `specgate migrate 1.0`, upgrade every open change whose `change.yaml` says `schema: spec-driven` to the `layered` schema: its `proposal.md` becomes `discover.md` with its text unchanged, a `design.md` is drafted from the proposal, its `tasks.md` is kept, and no archived change is read or rewritten.

#### Scenario: SCN-325a — An open change written with 0.27

- GIVEN a committed project with an open change `add-rates` written with `change new --schema spec-driven`, its proposal stating "Rates come from the provider."
- WHEN the person runs `specgate migrate 1.0`
- THEN `add-rates` has `discover.md` with the proposal's text, a `design.md`, its `tasks.md`, no `proposal.md`, and `schema: layered` in `change.yaml`

#### Scenario: SCN-325b — A delivered change

- GIVEN the same project with an archived 0.27 change
- WHEN the person runs `specgate migrate 1.0`
- THEN every file under the archive is byte for byte as before

<!-- specgate:trace status=Implemented test=tests/unit/migrate.test.ts actor=Developer kind=functional -->

### Requirement: REQ-326 — The migration can be previewed, and runs once

The system SHALL, on `specgate migrate 1.0 --dry-run`, print the same report a real run would and change no file; and SHALL, on a project already migrated, change nothing and say there is nothing left to migrate.

#### Scenario: SCN-326a — A preview

- GIVEN a project with an open 0.27 change
- WHEN the person runs `specgate migrate 1.0 --dry-run --json`
- THEN the report lists the change's actions, and no file in the project changed

#### Scenario: SCN-326b — A second run

- GIVEN a project migrated and committed
- WHEN the person runs `specgate migrate 1.0` again
- THEN it exits 0, plans no action and leaves every file as it was

<!-- specgate:trace status=Implemented test=tests/unit/migrate.test.ts actor=Developer kind=functional -->

### Requirement: REQ-327 — The migration starts from a commit

The system SHALL refuse `specgate migrate 1.0` without `--dry-run` when the project has uncommitted changes or is not a git repository, naming how to commit or stash first, and SHALL change nothing.

#### Scenario: SCN-327a — Work not committed

- GIVEN a project with an open 0.27 change and an uncommitted edit
- WHEN the person runs `specgate migrate 1.0`
- THEN it exits 1 with `migrate_dirty_tree` and the change still has its `proposal.md`

<!-- specgate:trace status=Implemented test=tests/unit/migrate.test.ts actor=Developer kind=functional -->

### Requirement: REQ-328 — The migration says what it did and what is left

The system SHALL write, when it changes anything, a report to `docs/specs/migration-1.0.md` and in `--json` that lists each step, the file actions it took and what a person must still do; the steps SHALL be one ordered table, so a step of a later 1.0 feature is added in one place.

#### Scenario: SCN-328a — The report of a real run

- GIVEN a project with an open 0.27 change
- WHEN the person runs `specgate migrate 1.0 --json`
- THEN `docs/specs/migration-1.0.md` names the change and `discover.md`, `design.md`, and lists reviewing the drafted design as a manual step, and the JSON has the same steps

<!-- specgate:trace status=Implemented test=tests/unit/migrate.test.ts actor=Developer kind=functional -->

### Requirement: REQ-329 — Status names the migration

The system SHALL, on `specgate status`, while an open change says `schema: spec-driven`, print one line naming `specgate migrate 1.0` and the number of such changes, and add a `migrate` key to `--json`; with none it says nothing about it.

#### Scenario: SCN-329a — A 0.27 project opened with 1.0

- GIVEN a project with one open 0.27 change
- WHEN the person runs `specgate status`
- THEN the output names `specgate migrate 1.0` once, and `status --json` has `migrate.changes` = ["add-rates"]

<!-- specgate:trace status=Implemented test=tests/unit/migrate.test.ts actor=Developer kind=functional -->

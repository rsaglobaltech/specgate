# Design: migrate-1-0

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/migrate.ts`: the steps of the 1.0 migration as a table
  (`MIGRATION_1_0`), each step planning file actions and manual items, and one
  `applyActions` that executes them.
- `scripts/cli/commands/project/MigrateCommand.ts` and `scripts/migrate.ts`:
  the `specgate migrate 1.0` command, in the command surface.
- `StatusCommand`: one line and a `migrate` key in `--json`.

## Mechanisms

- AC-1 — the `layers` step lists the open changes (`listChangeIds`, never the
  archive) whose `change.yaml` says `spec-driven`: `proposal.md` is renamed to
  `discover.md` unchanged, `design.md` is drafted with `designFromProposal`,
  `tasks.md` is kept (a draft without one gets the draft template), and the
  schema becomes `layered`.
- AC-2 — the archive is not listed by `listChangeIds`; nothing under it is read.
- AC-3 — `--dry-run` plans the same actions and prints the same report, writes
  nothing, and is allowed on a dirty tree because it changes nothing.
- AC-4 — a migrated change says `layered`, so the step plans nothing; with no
  action the report is not rewritten and the command says nothing is left.
- AC-5 — `git status --porcelain` must be empty (and the folder a git
  repository): the migration is undone with git, so it starts from a commit.
- AC-6 — the report goes to `docs/specs/migration-1.0.md` and `--json`. Steps
  are `{ id, title, plan(projectDir) }`; appending one to `MIGRATION_1_0` is the
  whole of adding a step. A `config` step checks the versions in
  `CONFIG_VERSIONS` (none changed yet).
- AC-7 — `status` reads the same `changesToMigrate` and prints one line.

## Channels

None: local files and git.

## Decisions

ADR-0042 (the layers) decided that a 0.27 proposal is read as the Discover; the
migration makes that explicit instead of leaving two layouts side by side.

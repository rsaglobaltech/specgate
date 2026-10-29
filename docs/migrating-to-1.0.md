# Migrating to 1.0

Specgate 1.0 is built on its own line (`next/1.0`) and released as candidates
(`1.0.0-rc.N`) before it becomes the version `npm install` gives. This page lists
every change that breaks a 0.27 project, what `specgate migrate 1.0` does about
each, and what is left to a person.

## Try it, or stay on 0.27

```bash
npm i -D @rsaglobaltech/specgate@next   # the latest 1.0 candidate
npm i -D @rsaglobaltech/specgate@0.27   # stay on 0.27; it keeps getting fixes
```

A candidate is published under the dist-tag `next`, never `latest`, and its
Docker image carries only its version (REQ-281): nothing moves to 1.0 unless you
ask for it.

## The migration, in one command

On a committed project:

```bash
specgate migrate 1.0 --dry-run   # what it would do; changes nothing
specgate migrate 1.0             # does it, and writes docs/specs/migration-1.0.md
git diff                         # review, then commit
```

- It refuses a tree with uncommitted work (`migrate_dirty_tree`) or a folder
  outside git (`migrate_not_git`): git is how you undo it. `--dry-run` runs
  anywhere, because it writes nothing.
- It only touches changes still open. An archived change — delivered work — is
  never read or rewritten.
- It runs once: on a migrated project it says there is nothing left and writes
  nothing, so the report of the run that did the work stays as it was.
- `--json` gives the same report as data: each step, its file actions and what
  is left to you.

`specgate status` names the command, once, while an open change is still
written for 0.27, and adds `migrate` to `status --json`.

## What breaks, and what migrate does

### A change has three layers (ADR-0042)

`change new`, `propose`, `propose --from-brief` and `--from-ticket` write
`discover.md` (product: context, use case, acceptance criteria `- AC-1: …`),
`design.md` (architect) and `tasks.md` (developer) under the `layered` schema,
and no longer write `proposal.md`.

| 0.27 | 1.0 |
| --- | --- |
| `proposal.md` | `discover.md`, the same text |
| — | `design.md`, drafted from the proposal's Approach |
| `tasks.md` | `tasks.md`, unchanged |
| `schema: spec-driven` | `schema: layered` |

**migrate does:** for each open change whose `change.yaml` says (or defaults to)
`spec-driven`, it moves `proposal.md` to `discover.md` word for word, drafts
`design.md` with every acceptance criterion it finds listed for the architect,
keeps `tasks.md` (a draft from a brief without one gets the empty draft list),
and sets `schema: layered`. Every other line of `change.yaml` — the reserved
range, an approval, the ticket — is kept.

**You do:**

- Review each drafted `design.md`: the architect answers each criterion there.
- Run `specgate change validate <id>`. A 0.27 proposal often names technology
  ("a REST endpoint", "Postgres") that the Discover should leave to the design:
  the layer rules warn, and `change validate --strict` fails, until it moves.
- Without migrating, a 0.27 change still validates: its `proposal.md` is read
  as its Discover, and a missing `design.md` is a `layer_no_design` warning
  whose fix names `specgate migrate 1.0`.
- `change new --schema spec-driven` still writes the 0.27 layout, for a team
  that needs one more change in it.

### A dependency on another repository (ADR-0041)

Inside a repository, `depends=<repo>:REQ-NNN` is a dependency on another
repository of the workspace, not an `unknown_dependency`: the workspace
(`specgate workspace check`) judges it.

**migrate does:** nothing; nothing in a 0.27 project needs rewriting.

**You do:** if a 0.27 project used `:` in a dependency for something else,
rename it. Then, for a product of several repositories, see
[Workspace](workspace.md).

### Configuration versions

No configuration file changes version in 1.0 so far. The migration checks each
one listed in its table (`harness_version` of `harness.config.yaml` today) and
raises it when a 1.0 feature does.

## What 1.0 adds without breaking anything

These need no migration. They are listed so the upgrade is complete:

- **The workspace** — several repositories of one product, ids qualified as
  `fleet:REQ-012`, a story split per repository ([Workspace](workspace.md)).
- **The backlog follows the phases** — `alm sync` moves a ticket as its change
  is proposed, built and archived; `alm pull` brings comments back as notes;
  Linear is a built-in provider ([Board phases](alm-phases.md)).
- **The two gaps** — `harness report` says whether a failure was the spec
  missing an intent or the code missing the spec
  ([Harness report](harness-report.md)).

## When a later candidate adds a step

The migration is one ordered table of steps (`MIGRATION_1_0` in
`scripts/lib/migrate.ts`). A candidate that adds a breaking change — roles and
approvers, for example — adds its step there, and `specgate migrate 1.0` on an
already migrated project runs only the new step. Read this page again for each
candidate: its sections are the list.

## If something goes wrong

- **Undo it:** `git checkout -- . && git clean -fd docs/specs` returns the tree
  to the commit the migration started from.
- **A change was not migrated:** its `change.yaml` names a schema other than
  `spec-driven` (a pack's own schema, say). Migrate leaves those alone; move its
  layers by hand or keep it as it is.
- **The report is not there:** nothing was migrated — the project had no open
  0.27 change and no configuration to raise.

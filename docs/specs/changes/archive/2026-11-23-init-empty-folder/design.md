# Design: init-empty-folder

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/cli/commands/project/InitProjectCommand.ts`.

## Mechanisms

- AC-1 — the question of a plain `init` in a terminal has three answers
  (`startOf`): `1` forja, `2` or Enter the specification only, `3` the wizard
  and its templates. `2` used to lead to the wizard, which chooses a stack.
  The specification only is `adopt` on the folder (REQ-608): `new project`,
  stack `TBD`.
- AC-2 — a plain `init` (no `--config`, `--yes`, `--out`, `--new`,
  `--multi-stack`, `--forja`) with no terminal runs the same `adopt` and exits 0. It used to exit 2 with "--config is required". With `--out` or `--new`
  and no `--config` or `--yes` it still does.
- AC-3 — `init --yes` scaffolds as before. It says "the project goes in a new
  folder here: <slug>/" where it said "using the current directory", warns
  that `--yes` took every default, naming the project type and the stack and
  `specgate config set stack`, and ends with `cd <slug> && specgate status`.
- AC-4 — nothing else in `init` changes: what `--yes`, `--config`, `--out`,
  `--new`, `--multi-stack` and `--forja` write is as it was.

## Not in this change

Changing what `init --yes` writes: scripts, the end-to-end journeys and the
studio rely on it, so it is a 2.0 question.

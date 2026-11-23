# Design: reproduce-first

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/cli/commands/spec/ReproduceCommand.ts` (new) — `specgate reproduce`.
- `scripts/lib/evidence.ts` — the red run, kept.
- `scripts/cli/commands/spec/DoneCommand.ts` — `apply_not_reproduced`.

## Mechanisms

- AC-1 — `specgate reproduce <change-id> --capability <c> --title "<what is
  broken>" [--ticket <KEY>]` runs `propose <change-id> --kind bug --capability
  <c> --reserve 1` (so the leak lowers the trust, REQ-673), then rewrites its
  delta: one requirement titled from `--title`, its trace `repro=required`,
  and its discover with the ticket and, when the map knows the capability's
  routes, where in the app the module is reached.
- AC-2 — `specgate reproduce run <REQ>` runs `bdd_cmd` with `{tags}` =
  `@<REQ>`: a failure writes `.specgate/evidence/<REQ>/red.json` (command,
  exit code, date) and `red.log`; a pass is refused `repro_not_red`, nothing
  written. No `bdd_cmd`: `repro_no_runner`.
- AC-3 — `apply` of a requirement whose trace says `repro=required` refuses
  `apply_not_reproduced` unless `red.json` exists, with the fix `specgate
  reproduce run <REQ>`; once delivered, `evidence.json` carries the red run
  beside the green one.

## Channels

None.

## Decisions

The red run is evidence like the green one, under `.specgate/evidence/<REQ>/`,
committed. `reproduce` reuses `propose --kind bug`, not a second way to open a
change.

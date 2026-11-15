# Design: migrate-from-035

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/migrate.ts`, `StatusCommand`.

## Mechanisms

- AC-1 — `lanesToMigrate`; `status --json`'s `migrate` gains `config`, and the
  human status says it.
- AC-2 — the layers step keeps every other line of `change.yaml` (`kind:`).
- AC-3 — the lanes step lists each tracked file that reads `SPECGATE_ROLE`.

## Channels

None.

## Decisions

None.

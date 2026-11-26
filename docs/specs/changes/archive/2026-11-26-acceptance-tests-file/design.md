# Design: acceptance-tests-file

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/acceptance.ts` (the file name), `scripts/lib/attack.ts`, `scripts/lib/acceptance-writer.ts`, `compat/writer-prompt.md` (the writer is told the new name), and their tests. No other source file changes.

## Mechanisms

AC-1 — `ACCEPTANCE_FILE` in `scripts/lib/acceptance.ts` becomes `acceptance-tests.md`; messages and fixes name it. `specgate acceptance` keeps `acceptance.md`. A change that has only an `acceptance.md` is not read as a list of tests: the sign-off checklist is never sealed. Nothing was released with the old name, so there is nothing to migrate.

## Decisions

The older feature keeps its file: it shipped. The new one, unreleased, takes the new name.

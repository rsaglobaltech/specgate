# Design: rc11-contract

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/workspace.ts` — `contractCitations` calls `conformanceWarnings` as `contractNotMet` does.

## Mechanisms

- AC-1 — `conformanceWarnings(…, pieces = true)`: `routeInPieces` counts as in REQ-418.
- AC-2 — a member whose role is `contracts` is skipped; its unqualified `api=` are its own operations.
- AC-3 — the whole-path and in-pieces checks still fail on a missing segment, and the warning names `<repo>:REQ-NNN`.

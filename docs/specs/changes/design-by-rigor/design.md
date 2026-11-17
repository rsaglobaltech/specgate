# Design: design-by-rigor

> Owner: architect — how the system meets the Discover.

## Modules

`packages/core/src/domain/ChangeLayers.ts`, `scripts/lib/approvals.ts`,
`scripts/change/artifacts.ts`, `packages/core/src/application/ValidateChangeUseCase.ts`.

## Mechanisms

- AC-1 — `checkLayers` judges the criteria only in a written design, and
  without the lines it shares with its template (whose guidance names AC-1, AC-2).
- AC-2 — `rigor: full`: `layer_design_not_written` while design.md is as
  scaffolded; `changeApprovals` is not approved, and `missingApprovals` says
  the design is not written, so the harness refuses with `harness_not_approved`.
- AC-3 — `rigor: lite` (the default): an unwritten design is `skipped` in the
  artifact graph of a layered change too (ADR-0018), so tasks are not blocked
  and status does not ask for it; approvals count only the written layers.

## Channels

One new diagnostic code, `layer_design_not_written`.

## Decisions

Rigor decides, rather than the design always being owed: a single person
working with an agent should not write a design for every small change.

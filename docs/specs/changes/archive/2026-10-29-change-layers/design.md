# Design: change-layers

## Technical approach

`packages/core/src/domain/ChangeLayers.ts` holds the layers, their templates,
the criteria parser, `checkLayers` and `designFromProposal` (for
`specgate migrate 1.0`). `ValidateChangeUseCase` reads the Discover from
`discover.md`, else `proposal.md`, and adds `checkLayers`' warnings.
`change validate` adds the REQ-287 warning from git history. The schema
registry gains `layered`, which `change new`, `propose --from-brief` and
`--from-ticket` write; a change without `schema:` stays `spec-driven`.

## Decisions

### Decision: discover.md, with proposal.md as the 0.27 Discover

Renaming every proposal would break every change in flight; keeping the name
would leave the Discover indistinguishable from a 0.27 proposal that mixes the
layers. New changes write `discover.md`; readers fall back to `proposal.md`.

### Decision: warnings, not errors

A change is written one layer at a time and `validate --strict` runs on every
open change: errors would fail the project's gate while the architect has not
written the design. `change validate --strict` fails on them.

# Design: rc6-deps

> Owner: architect — how it is built: modules, mechanisms, channels.

## Modules

- `scripts/change/instructions.ts` — `LAYERED_DESIGN_RULES`, the rules of `change instructions design`
  and of the prompt `change author design` gives.
- `scripts/lib/workspace.ts` — `acrossRepositories`, the story context of a sub-change's design.
- `packages/core/src/domain/ChangeLayers.ts` — `crossReferences`.

## Mechanisms

- AC-1 — a rule of the layered design: a `depends=<repo>:REQ-NNN` or `api=<file>#<operationId>` the design
  decides goes into the requirement's `specgate:trace` in the delta under `specs/` too, since the harness
  orders the parts and checks the contracts from the traces (`layer_design_dependency_untraced`). The
  author's scope is the change directory, so the agent writing design.md may edit the delta's traces.
  The story context says the same.
- AC-2 — `crossReferences` takes `api=` as a reference only when something other than `#` follows the
  `#`: `#<operationId>` stops the match at `<` and left a bare `#`.

## Decisions

- A rule, not an automatic copy from design.md into the traces: the design names dependencies in prose and
  tables, and which requirement one belongs to is the architect's reading.

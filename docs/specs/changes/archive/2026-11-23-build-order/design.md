# Design: build-order

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/lib/build-order.ts` (new), `scripts/cli/commands/spec/StatusCommand.ts`,
`scripts/cli/commands/harness/RunCommand.ts`.

## Mechanisms

- AC-1 — `modulePlaces`: each requirement's module of the brief, from the
  requirements its draft (`draft-<module>`, open or archived) and the
  capabilities it wrote declare. `inBuildOrder` sorts stably by the module's
  rank; a requirement outside every module keeps its side (spec.md's own first,
  others after). `summarise` orders the queue with it, so `status`, `apply`
  with no id and `status --prompt` agree; the harness orders its queue the same
  way before `depends=` and `--chain`.
- AC-2 — `whyNext`: "users, the brief's 1st module of 2", leading the reason
  `status` gives for the next step.
- AC-3 — no brief, or a brief with no modules: `inBuildOrder` returns the
  matrix's order.

## Channels

None: no command, flag or code. A patch release.

## Decisions

The matrix file is not reordered — that would rewrite a hand-kept matrix;
only the queue read from it is.

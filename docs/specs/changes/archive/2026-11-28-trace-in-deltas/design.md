# Design: trace-in-deltas

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/change/ChangeCommand.ts`, `tests/unit/trace-values.test.ts`.

## Mechanisms

AC-1 — `cutTraceValues` runs `strayTraceWords`, the reader `validate` uses (REQ-798), on each delta of the change, and `change validate` adds a `trace_value_cut` warning per finding.

## Decisions

A warning, as in `validate`: the value still parses, only shorter.

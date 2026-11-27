# Design: trace-values

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`packages/core/src/domain/SpecParser.ts`, `packages/core/src/domain/DomainView.ts`, `scripts/lib/domain-docs.ts`, `scripts/cli/commands/quality/ValidateSpecsCommand.ts`, and their tests.

## Mechanisms

AC-1 — `strayTraceWords` in the spec parser scans each `specgate:trace` comment outside a fence and returns, per unquoted value followed by words with no `=`, the line, the key, what is read and what was meant. `validate` warns for each, beside the warning for a trace outside a requirement (#79).

AC-2 — the domain view and the actors list call `parseTraceComment` on the trace comment instead of their own patterns.

## Decisions

A warning, not an error: a project whose actors were cut has passed validate until now, and the fix is the person's to make. Joining the words back silently was rejected: `kind=functional status` is a typo, not a value with a space.

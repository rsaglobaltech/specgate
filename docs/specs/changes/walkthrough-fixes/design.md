# Design: walkthrough-fixes

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/spec/StatusCommand.ts`, `packages/core/src/domain/DerivedMatrix.ts`, `packages/core/src/domain/DeltaFeature.ts`, `scripts/lib/acceptance.ts`, `scripts/plugin/project-state.ts` (and the shipped plugin copy), `scripts/cli/commands/quality/CheckCommand.ts`, `scripts/cli/commands/change/ChangeCommand.ts`, and their tests (`tests/unit/walkthrough-fixes.test.ts`, `tests/unit/sealed-acceptance.test.ts`).

## Mechanisms

AC-1 — `status` adds to its summary the open changes `missingApprovals` names; the next command for a requirement of one of them is `specgate change approve <id>`, and the reason says it waits for a person.

AC-2 — `setTraceFields` reads a trace comment from its first line to the line that holds `-->`, and replaces the span with one rendered line; `withDefaultFeaturePaths` recognises a trace comment by its start and looks for `feature=` in the whole comment.

AC-3 — `sealedAcceptance` reads the acceptance records of archived changes too, oldest first, then the open ones: a newer seal of a file replaces an older one. The gate's acceptance stage checks the archived ones first (`acceptance_not_sealed`, its fix: restore it, or open a change that lists it); the guard's `sealedTests` and the judge read them too.

AC-4 — when every problem of the open changes is something a person approved that changed, `check` ends with `check_approved_changed` and that problem's fix; a failing acceptance stage ends with `check_acceptance_failed`; `approve_needs_person`'s fix carries `--layer` when one was asked.

## Decisions

The seal of an archived test is changed only by a new change that lists it and a person's approval — the same road as any contract change.

# Design: slow-tests-hint

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/spec/DoneCommand.ts`, `docs/fast-gate.md`, `docs/es/fast-gate.md`, and their tests.

## Mechanisms

AC-1 — `apply` times its tests stage. After the delivery, beside the note that the scenarios were not run (REQ-735), `slowTestsNote` says how long the whole suite took and the `config set test_cmd_affected` line built from the command it ran. Two minutes is the limit; `SPECGATE_SLOW_TESTS_MS` stands in for it in tests, as `SPECGATE_TODAY` does for the clock.

AC-2 — no note under the limit, or when the command holds `{files}` or `{req}`.

## Decisions

A note, not a finding: the delivery succeeded and nothing is wrong. `init` guessing `{files}` per runner was rejected: `npm test -- {files}` runs the whole suite under some runners, and a wrong guess is a slower gate that looks scoped.

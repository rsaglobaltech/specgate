# Design: recover-guidance

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/tests-elsewhere.ts` (new), `scripts/cli/commands/spec/DoneCommand.ts`, `scripts/cli/commands/quality/CheckCommand.ts`, `templates/base/AGENTS.md.tpl`, and their tests (`tests/unit/recover-guidance.test.ts`).

## Mechanisms

AC-1 — `failingElsewhere` reads a test run's output: the lines a runner marks as failed (node:test, TAP, Jest/Vitest, JUnit/Maven, pytest) and the requirement ids they name. When they name none of the requirements being delivered, `apply`'s `done_tests_failed` says which ones are red and its fix says to repair their code — never their test — and that the design's scope judges new files only; `check`'s `check_tests_failed` names the red requirements with the same fix.

AC-2 — the AGENTS.md template says, before "Never", that a delivered requirement's red test blocks every delivery and is repaired in its code, within the change's scope.

## Decisions

Reading the runner's output is a heuristic: a test that names no requirement gives the message as before.

# Design: evidence-attempts

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/evidence.ts`, `scripts/cli/commands/spec/DoneCommand.ts`, `scripts/lib/evidence-page.ts`, `scripts/lib/evidence-html.ts`, docs, tests.

## Mechanisms

AC-1 — when `apply`'s scenarios fail, `keepAttempt` writes `.specgate/evidence/<REQ>/attempts/<n>/`: `run.json`, `run.log` and `artifacts/` (screens, traces, the AI log), `n` one more than the last; `apply_bdd_failed` names the folder. Its artifacts stay out of git. The delivery's `evidence.json` lists the attempts.

AC-2 — the page reads each attempt's log with `scenarioOutcomes` and its AI log, and shows a "Failed attempts" table, in Markdown and HTML.

AC-3 — `keepBefore` removes `attempts/`.

## Decisions

Kept after the delivery, not dropped: a flaky delivery is what the reviewer most needs to see.

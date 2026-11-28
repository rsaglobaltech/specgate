# Design: evidence-details

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

New `packages/core/src/domain/ScenarioOutcomes.ts`, `scripts/lib/trace-zip.ts`; `scripts/lib/evidence.ts`, `scripts/lib/evidence-page.ts`, `scripts/lib/scenario-runs.ts`, `EvidenceCommand.ts`, `ReproduceCommand.ts`, `DoctorCommand.ts`; docs; tests.

## Mechanisms

AC-1 — `scenarioOutcomes(log)` reads Playwright's list reporter in `before/run.log` and `bdd.log`: each `✓`/`✘` line (scenario, tags, time), and each numbered failure (the failing step, its `Error:`, `Expected:`, `Received:` lines). The page has a table, one row per scenario.

AC-2 — `trace-zip.ts` reads a Playwright `trace.zip` with `zlib` (no dependency): the `*.trace.network` lines whose request goes to the project's service (`/api/`, or made through the test's request context), each with its request and response bodies from `resources/`. Headers are not shown; a JSON key named like a token, password, secret, cookie or authorization is written `«hidden»`. The page pairs the calls by method and path, before and after. `doctor_evidence_media` asks for `trace: 'on'` too: a passing test keeps no trace otherwise.

AC-3 — every run of the scenarios Specgate makes sets `SPECGATE_AI_LOG` to `test-results/specgate/ai-decisions.jsonl`, emptied first. A project that writes one JSON line per model call there (`model`, `input`, `output`, `ms`) gets it kept with the artifacts and shown as a table on the page, before and after.

## Decisions

Reading the runner's log, not a JSON reporter: the project's `bdd_cmd` is its own, and the log is already kept. The AI record is the project's to write: Specgate cannot see inside a server, and a convention costs one environment variable.

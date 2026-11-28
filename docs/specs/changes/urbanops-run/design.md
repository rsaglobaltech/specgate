# Design: urbanops-run

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`packages/core/src/domain/BriefCards.ts`, `scripts/lib/bdd.ts`, `scripts/cli/commands/project/MigrateCommand.ts`, `scripts/lib/evidence-page.ts`, `packages/core/src/domain/UmlDiagrams.ts`, tests.

## Mechanisms

AC-1 — `WHETHER` lists the verbs of determining, evaluating, confirming, validating and reviewing, Spanish and English (REQ-820).

AC-2 — `skipAdoptionBaseline` puts `@skip` (which playwright-bdd skips) and a comment above the baseline scenario; `migrate bdd` calls it and reports `baselineSkipped`; `bddFindings` warns `bdd_baseline_runs` while it is untagged (REQ-822).

AC-3 — `evidenceBase`: with no `--base`, when `baseOf` is HEAD, the parent of the first commit that touches `docs/specs/changes/<id>`; `changeEvidence` uses it, so `evidence` and `archive` both do (REQ-821).

AC-4 — `codeSequence` finds the exception by its own type first, else by the throw statement (`throw new X(…)` or `-> new X(…)`) that carries the THEN's code or a quoted fragment of its message; only that throw ends the scenario. A call on a project type's name is a static operation, drawn on the class's lifeline (REQ-812).

## Decisions

`@skip` rather than deleting the baseline: REQ-001's trace names the file. Cucumber runners do not skip `@skip` by themselves; the warning's fix says what keeps the promise.

# Design: urbanops-run

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`packages/core/src/domain/BriefCards.ts`, `scripts/lib/bdd.ts`, `scripts/cli/commands/project/MigrateCommand.ts`, `scripts/lib/evidence-page.ts`, `packages/core/src/domain/UmlDiagrams.ts`, tests.

## Mechanisms

AC-1 — `WHETHER` lists the verbs of determining, evaluating, confirming, validating and reviewing, Spanish and English (REQ-820).

AC-2 — `skipAdoptionBaseline` puts `@skip` (which playwright-bdd skips) and a comment above the baseline scenario; `migrate bdd` calls it and reports `baselineSkipped`; `bddFindings` warns `bdd_baseline_runs` while it is untagged (REQ-822).

AC-3 — `evidenceBase`: with no `--base`, when `baseOf` is HEAD, the parent of the first commit that touches `docs/specs/changes/<id>`; `changeEvidence` uses it, so `evidence` and `archive` both do (REQ-821).

AC-4 — `codeSequence` finds the exception by its own type first, else by the throw statement (`throw new X(…)` or `-> new X(…)`) that carries the THEN's code or a quoted fragment of its message; only that throw ends the scenario. A call on a project type's name is a static operation, drawn on the class's lifeline (REQ-812). The sequence leaves out what is computation, not conversation: calls on the platform's value and utility types (`PLATFORM`: `String`, `Clock`, `List`…), a parameter hiding the field of the same name, a private helper that draws nothing and has no `throw`, and a builder's consecutive repeats (`sql().param().update()`).

REQ-823, found delivering REQ-005 after this story was agreed — `bddRefusal` runs the scenarios inside `ui.task`, labelled `Scenarios` and the command, as the other stages are; `--json` unchanged.

REQ-824, after the run showed most holes were in the reading of code, not in the gate — `scripts/lib/sequence-check.ts`: the diagram's call into the service and its last reply, against the scenario's calls; `matches`, `differs`, `unchecked` or `steps`. The calls come from the browser's trace and from `SPECGATE_HTTP_LOG`, which `scenarioEnv` sets beside `SPECGATE_AI_LOG`; a logged call belongs to the scenario whose `test.trace` window (`wallTime` to its last `endTime`) holds its `at`. The calls table pairs within each scenario.

## Decisions

A reading of the code is checked, not trusted: a sequence that cannot be checked says so, rather than looking as sure as one that was.


`@skip` rather than deleting the baseline: REQ-001's trace names the file. Cucumber runners do not skip `@skip` by themselves; the warning's fix says what keeps the promise.

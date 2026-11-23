# Design: skill-evals

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/SkillEval.ts` (new) — scores and comparison, pure.
- `scripts/cli/commands/harness/EvalCommand.ts` (new) — `specgate eval`.

## Mechanisms

- AC-1 — `evals/<skill>/eval.yaml`: `skill` (the file handed to the agent),
  `agent` (`{prompt_file}`; default the harness's), `runs` (default 3),
  `concurrency` (default `runs`), `reviewer` (optional command, `{dir}`,
  prints a score 0–10), `tasks` (each `id`, `fixture` — a project folder
  under the exam —, `prompt`). Each run: the fixture copied to a temp folder
  with a fresh git repository; the prompt file is the skill, then the task;
  the agent runs there; then `specgate check --json`. Correct: check exits 0.
  Good: the mean of the `architecture` and `quality` stages that ran (1
  passed, 0 failed) and the reviewer's score ÷ 10; null when none ran. Runs go
  in parallel up to `concurrency`; the temp folders are removed.
- AC-2 — the skill's version is the first 12 hex of the sha256 of its text.
  Each exam appends to `evals/<skill>/history.jsonl` (date, version, runs,
  correct, good, per task). The result compares with the last exam of another
  version: `better`, `worse` or `same` for correct and for good (a change of
  5 points or less is the same).

## Channels

None: files and the CLI.

## Decisions

The gate is the judge of correct, never the agent itself. A skill
contradicting another is left out: it needs two skills examined together.

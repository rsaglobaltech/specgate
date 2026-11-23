# Design: eval-list

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/cli/commands/harness/EvalCommand.ts` — `--list`, and the progress file.
- `packages/core/src/domain/SkillEval.ts` — `historyByVersion`.

## Mechanisms

- AC-1 — `specgate eval --list [--json]`: each `evals/<skill>/eval.yaml`:
  the skill's name and file, its version now (sha256 of its text, 12 hex),
  its agent, runs per task, each task's id and whether it has a hidden
  `check:`; its history in order, one row per exam (at, version, runs,
  correct, good) and per version the last exam's scores with the trend
  against the previous version (better, worse, same within 5 points).
- AC-2 — while `specgate eval <skill>` runs it writes
  `evals/<skill>/running.json` (started, total runs, ended, correct), updated
  after each run and removed at the end; `--list` shows it as `running`.

- AC-3 — each exam gets a folder `evals/<skill>/runs/<stamp>/`; each run
  `<task>-<n>/` holds `prompt.md` (what the agent was handed, the skill and
  the task), `log.jsonl` (one line per event, appended as it happens:
  `start`, `output` with each chunk the agent printed, `check` with
  `specgate check`'s exit and summary, `hidden` with the hidden check's exit
  and output, `end` with correct and good) and nothing else. The copy
  itself is still removed. `--list` adds the skill's whole text, the exam file's (`eval.yaml`) whole
  text, each task's
  prompt and check command, and the last exam's runs with their folders and
  state; `runs/` is ignored by git, and only the last 5 exams' folders are
  kept.

## Channels

None: the CLI and files. The studio reads `eval --list --json`.

## Decisions

The progress file lives beside the exam and is ignored by git.

# Design: lab-fixes

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/harness/prompt.ts` — the principles section (AC-1).
- `scripts/harness/run/gate.ts`, `scripts/lib/steering.ts` — a `principles` stage (AC-1).
- `scripts/lib/trust.ts` `chainRefusal` — the main branch only (AC-2).
- `scripts/harness/run/*` dry run — the trust skip (AC-3).
- `packages/core/src/infrastructure/DerivedMatrixSources.ts` — tooling left out of code (AC-4).
- `packages/core/src/domain/SkillEval.ts`, `EvalCommand.ts` — `check:` per task (AC-5).

## Mechanisms

- AC-1 — `docs/specs/principles.md`, when present: each principle's id, title
  and statement go into the prompt under "Principles"; after the tests, the
  gate runs each `run=` principle in the worktree as the stage `principles`;
  a failing error-level principle fails the gate with its id and command, a
  warn-level one is reported and passes.
- AC-2 — `chainRefusal` refuses only on the main branch: `main`, `master`, or
  the branch `origin/HEAD` names. The level-6 reservation stays for merges
  into that branch.
- AC-3 — on `--dry-run`, a requirement the trust level refuses prints
  `skipped (trust_level): <reason>` instead of its prompt.
- AC-4 — the files named by `bdd_cmd`, `arch_cmd` and `test_cmd` (each word of
  the command that is a file in the project) are tooling, and `evals/` holds
  exam fixtures: neither is code or a test of a requirement (the walk skips
  `evals/`).
- AC-5 — a task's `check:` is a shell command run in the copy after the agent
  finishes and after `specgate check`; its files (`check_files:`) are copied
  in only then. Correct needs both. The prompt never mentions them.

## Channels

None: the CLI and files.

## Decisions

Chaining stays refused on the main branch: that merge is still a person's,
until level 6 exists.

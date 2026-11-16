# Design: harness-hardening

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/harness-guard.ts` (run lock), `scripts/harness/worktree-lock.ts`,
`scripts/cli/commands/harness/RunCommand.ts`, `packages/core/src/domain/HarnessRun.ts`.

## Mechanisms

- AC-1 — The run lock is created with `wx` (only if absent); a lock whose
  process is gone is renamed aside — once, by one run — and created again. The
  worktree lock lives in the repository's common git directory, also when
  `.git` is a file; a lock just made with no owner yet is "being taken" for 5 s,
  not stale; a lock that cannot be made at all does not spin for 30 s.
- AC-2 — The run record is written to a temporary file and renamed. The prompt
  file is created `0600` and removed in a `finally` when a step throws.
  `harness/base/*` branches are deleted at the end of the run. A branch that
  cannot be deleted to recreate it fails the requirement with git's reason.
- AC-3 — `substituteGateCommand` takes a quote function; the harness passes
  `quoteArg`, which leaves plain values as they are. `pr_cmd`'s `{branch}` and
  `{req}` are quoted too.
- AC-4 — `builtin:review` without a `VERDICT:` line is a failed check. A test
  command cut at the deadline is reported as `(timed out)` with the time.
- AC-5 — `scrubText` (token-like values, and the values of secret environment
  variables) is applied to every string of the run record and to the prompt
  archive; stage names, events and the dry run show masked commands.

## Channels

None new; no addition to the public surface.

## Decisions

Quoting leaves `[A-Za-z0-9_./:@=,+-]` values untouched, so every command that
worked keeps its exact text.

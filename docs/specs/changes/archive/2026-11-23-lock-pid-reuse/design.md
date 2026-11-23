# Design: lock-pid-reuse

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/process-start.ts`, `scripts/lib/harness-guard.ts` (run lock),
`scripts/harness/worktree-lock.ts`.

## Mechanisms

- AC-1 — The run lock records when it was written (`startedMs`); the worktree
  lock already did (`at`). A lock whose pid is alive counts only if that process
  started no later than the lock was written (a second of slack: `ps` rounds to
  the second). The start comes from `ps -o lstart` (macOS, Linux) or
  `Get-Process` (Windows); where neither answers, the pid alone decides, as
  before.

## Channels

None: `startedMs` is a new field of the lock file, which only the harness reads.

## Decisions

A process start time, not a random token in the lock: a token says who wrote
the lock, not whether that process is the one alive now.

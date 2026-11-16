# Discover: harness-hardening

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The rest of the 1.0.x findings of issue #466, after harness-safety: two runs
starting together could both take the working copy; a project that is itself a
worktree waited 30 s on every lock; a crash could leave the run record half
written and prompt files in the temp folder; values put into gate commands were
not quoted; a reviewer that said nothing counted as approving; a test command
cut at the deadline read like an ordinary failure; and secrets reached the run
record and the prompt archive that is pushed with each branch.

## Use case

A team runs the harness in CI and on laptops, on repositories with worktrees,
with credentials in the environment, and reads the record and the branches it
leaves.

## Acceptance criteria

- AC-1: Only one run holds a working copy at a time, and a run that died does not keep it.
- AC-2: A run leaves no half-written record, no stray prompt file and no throwaway branch behind.
- AC-3: A value the harness puts into a command is one argument of it.
- AC-4: Nothing counts as a pass that did not say so, and a timeout is said as a timeout.
- AC-5: No secret reaches what the run writes for others to read.

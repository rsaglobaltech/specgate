# Design: runner-group

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/deadline-runner.ts`.

## Mechanisms

- AC-1 — When the command's shell ends, for any reason, the runner sends
  SIGKILL to the command's process group before it exits (POSIX). On Windows
  the tree was already followed with `taskkill /T` at a signal or a deadline.

## Channels

None.

## Decisions

Killing the group on every exit also ends what an agent leaves running behind
it (a dev server, a watcher) once its session is over — what the harness wants
anyway: the next step must start from a quiet worktree.

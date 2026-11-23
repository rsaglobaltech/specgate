# Design: harness-safety

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/deadline-runner.ts` and `run-with-deadline.ts` (the process every
command runs under); `scripts/cli/commands/harness/RunCommand.ts` (gate,
chain, workers, agent checks).

## Mechanisms

- AC-1 — The runner puts its command in a process group of its own (#66),
  which a terminal's Ctrl-C does not reach. It now ends that group on SIGINT,
  SIGTERM and SIGHUP, and when its parent or the run's root process
  (`SPECGATE_HARNESS_ROOT_PID`, set once per run and inherited by workers) is
  gone; it then exits 198. `runWithDeadline` turns 198 into
  `HarnessInterrupted`; the requirement keeps its worktree for `--resume`, and
  the run exits 130 with `harness_run_error`.
- AC-2 — The chain records `HEAD` before merging. A refused merge commit, a
  failed amend or a red post-merge gate resets to that commit, never
  `HEAD~1`. A merge with generated conflicts is concluded by the chain itself,
  as one checked commit.
- AC-3 — The architecture and test commands, the reviewer and adversary agents,
  the adversary's tests, `setup_cmd` and `pr_cmd` run under the runner, with
  the run's `--timeout`; `done` gets a timeout of its own.
- AC-4 — A worker gets `--resume`, `--skip-not-ready`, `--strict-artifacts`,
  `--verbose`, `--push` and `--remote`; `--agent`, `--test-cmd` and `--pr-cmd`
  go in `SPECGATE_HARNESS_WORKER_ARGS`, read once and removed from its
  environment.
- AC-5 — A check's profile is resolved from the project the worktree belongs
  to (its git common directory), never from the worktree.

## Channels

None new: the run's JSON keeps its shape and codes (a 1.0.x patch adds nothing
to the public surface).

## Decisions

The runner, not the harness, ends the command on a signal: the harness waits in
`spawnSync`, where a signal handler of its own cannot run until the command has
ended.

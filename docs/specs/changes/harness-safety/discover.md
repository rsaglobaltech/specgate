# Discover: harness-safety

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A review of the harness at 1.0.0 (issue #466) found five ways an unattended run
can lose a person's work or do something it does not say: stopping a run left
its agent working in the repository; a chain whose merge commit was refused
could fold the merge into the person's own last commit, or delete it; a test or
setup command that hung was never ended; a run with several requirements at
once dropped options such as resuming; and the agent could choose the command
that reviews its own work.

## Use case

A developer starts a run, stops it with Ctrl-C, and starts it again with
`--resume`; or leaves a chain running overnight on a repository with its own
commit hooks; or runs four requirements at once with `--resume`.

## Acceptance criteria

- AC-1: Stopping a run, or the run dying, ends every command it started; the work in progress is kept for resuming.
- AC-2: A chain whose merge cannot be recorded leaves the person's branch exactly as it was.
- AC-3: Every command the harness runs ends at the run's time limit, with everything it started.
- AC-4: A run with several requirements at once honours every option a run of one does, and its commands are not shown to other users of the machine.
- AC-5: Nothing the agent writes decides which command checks its work.

# Discover: runner-group

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

1.1.0's `harness stop --now` could leave the agent running on Linux, now and
then: the command that ends a run signals every process it started, and when
the shell between the harness and the agent ended first, the harness took it
for the agent finishing on its own and left the agent — which ignores the
polite signal — working in the repository. Found by 1.1.0's own release, in
the GitHub Packages job.

## Use case

A person stops a run at once while its agent works.

## Acceptance criteria

- AC-1: Nothing a command started outlives it, however the command ends.

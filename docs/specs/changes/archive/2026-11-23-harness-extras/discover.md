# Discover: harness-extras

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The last part of issue #466. An agent ran with the whole machine and its
network; every worktree downloaded the same dependencies again; a team that
watches its pipelines in a tracing tool could not see a harness run there; and
a person who wanted to look at a failed attempt before the next one had to stop
the run.

## Use case

A team runs the harness on shared CI with the agent in a container, a cache,
and its runs in its tracing tool; a developer at a laptop steps through the
attempts of a hard requirement.

## Acceptance criteria

- AC-1: The agent can run in a container that sees only its worktree, has no network unless allowed, and gets only the variables named.
- AC-2: The dependencies one worktree downloaded are not downloaded again by the next.
- AC-3: A finished run can appear in an OpenTelemetry collector as a trace.
- AC-4: A run can wait for a person between a failed attempt and the next, who lets it go on or stops it.

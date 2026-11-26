# Discover: guard-scope-and-seal-run

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The replication of 2026-11-26 left four Codex runs failing. In one, Codex wrote
a file nobody asked for and linked it to an unrelated requirement's test; the
gate refused it at the end, but the file was written. In two, the agent that
wrote the acceptance tests sealed tests that load the code by a wrong path: no
implementation could make them pass, and nothing showed it to the person who
sealed them.

## Use case

An agent is told "no" before it writes work nobody approved; a person sealing
acceptance tests sees them run once.

## Acceptance criteria

- AC-1: a new source file outside the approved design is refused when written, with what to do instead.
- AC-2: sealing runs the tests once and shows the person why they fail.

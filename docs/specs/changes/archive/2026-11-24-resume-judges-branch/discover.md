# Discover: resume-judges-branch

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A Developer continues a requirement whose branch an earlier run left behind.
When that branch already holds the work, the agent has nothing to add, and the
run fails as if the agent could not write. Found live on 2026-11-24 in
pintamundo-ai: REQ-002 "Continue" failed in 22 s with "no-op" while its branch
held the test and the code.

## Use case

1. The Developer presses Build on a requirement whose branch exists, and chooses to continue it.
2. The agent finds the work done and writes nothing.
3. The gate judges the branch as it stands: it passes and the branch is ready to review, or it fails and the next attempt is told why.

## Acceptance criteria

- AC-1: a continued branch that already holds work is judged by the gate when the agent adds nothing.
- AC-2: a run that is not a continuation, or a branch that holds nothing beyond its base, still stops as "no-op".

# Design: resume-judges-branch

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/harness/run/worktree-checks.ts` — `branchHoldsWork`: files the branch changed since its base, the prompt archive left out (AC-1, AC-2).
- `scripts/harness/run/attempt.ts` `checksBeforeGate` — on a resumed attempt that produced nothing, the gate runs when the branch holds work (AC-1); otherwise the no-op stop is unchanged (AC-2).

## Mechanisms

The base is `git merge-base <baseRef> HEAD`. On a pass, `closeAttempt` marks
the requirement, so the commit it makes is never empty.

# Discover: recover-guidance

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the exam of 2026-11-25, four of six Claude Code runs of the `recover` task
stopped short. Their own requirement was done, but the suite was red because
the test of a requirement delivered earlier failed, and they said repairing it
was outside their requirement and the approved design. One wrote the one-line
fix and did not apply it. Specgate had taught them to keep to their scope, and
never told them that repairing a delivered requirement's code — never its
test — is within it.

## Use case

1. An agent delivers its requirement; the suite is red because another
   requirement's test fails.
2. The gate says whose test is red, that it is repaired in the code, never in
   the test, and that this is within the change's scope.
3. The agent repairs it and delivers.

## Acceptance criteria

- AC-1: when only another requirement's test fails, `apply` and `check` name that requirement and say to repair its code, not its test, as part of the change.
- AC-2: the agents' instructions say the same.

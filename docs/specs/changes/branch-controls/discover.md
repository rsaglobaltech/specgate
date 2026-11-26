# Discover: branch-controls

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The outside judge (REQ-747) compares the controls before and after an agent's
run — in the harness and in the exam. In a team's own work there is no such
run: an agent works on a branch, and the branch is reviewed and merged. A branch
that switched the guard off, loosened the gate's policy, approved a change or
removed evidence looks, in the diff, like any other file. Who approved cannot be
told from the branch; that a control changed can, and the reviewer is the person
who decides.

## Use case

1. A branch is checked against its base: `specgate check --base main`, in CI.
2. Each change the branch makes to the controls is named, in words, for the reviewer.
3. The reviewer reads them before the merge; a team that wants it can make the gate fail on them.

## Acceptance criteria

- AC-1: `check` against a base names every control the branch changed: the guard's switch, the gate's policy, an open change's approval, a requirement's evidence.
- AC-2: an approval that left with its change into the archive is not named.
- AC-3: it is reported by default and fails the gate only where the policy says `controls: error`.

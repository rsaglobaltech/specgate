# Proposal: harness-red-base

## Intent

The harness gate runs `validate --strict` on the whole project. When the base already fails it, every attempt fails too, for a reason outside the requirement the agent is working on: in an adopter's project, 75 requirements marked Approved before their tests failed TDD-1 on the base, and all three attempts on REQ-002 were paid for and thrown away. Nothing said the base itself was red until the report listed the same 75 findings.

## Scope

Before any worktree is created and any agent runs, `harness run` validates the base as `specgate check` does. If it fails TDD-1 or TDD-2 on a requirement outside the run, which no attempt may fix since the agent does not touch the specification, the run stops with those findings and the fix, and creates no branch. What fails on the requirements being run (a missing feature, say) is theirs to fix and does not stop it. `--skip-baseline` runs anyway. Skipped with `--base-branch`, whose ref this checkout does not hold, and in workers, whose parent has already checked.

## Out of scope

Running the project's tests on the base: they can take minutes, and a red suite is already said by the first attempt's gate output.

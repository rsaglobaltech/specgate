# Proposal: add-change-lifecycle

## Intent

The tool has no object for "a change in flight". Review happens over a diff of
three files that must be edited in lockstep, so the reviewer reconstructs the
proposed behaviour from the wreckage instead of reading it. Brownfield adoption
is second class for the same reason.

## Scope

In scope:

- A change folder: proposal, design, tasks, delta specs, proposed features.
- Delta specs with ADDED / MODIFIED / REMOVED sections.
- `specgate change new | list | show | status | validate | archive`.
- An archive that merges deltas into capability specs, upserts the
  traceability matrix and materialises the proposed `.feature` files.

Out of scope (later phases):

- `specops diff --as-change` and `specops contribute` (F1B).
- Configurable artefact schemas (F3).
- `--json` on commands other than `change *` (F2).

## Approach

Additive. Nothing existing changes shape: a project with no `docs/specs/changes/`
behaves exactly as before, and `archive` is the only writer of both the
capability specs and the matrix. The delta format is markdown so the review
surface is readable in a PR without tooling.

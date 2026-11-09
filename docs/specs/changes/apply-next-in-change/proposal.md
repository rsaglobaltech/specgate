# Proposal: apply-next-in-change

## Intent

After `specgate apply` delivers a requirement, it prints the next step. Today
that step is the first requirement of the whole project's queue, wherever it
is: in specgate-studio, applying REQ-016 of `draft-specgate-port` printed
`specgate apply REQ-000` — the health baseline `init` scaffolded — although
the change itself still had REQ-014 to do. The person loses the thread of the
change they are building.

## Scope

In scope:

- After `apply`, the next step is the next requirement of the same open change
  that is still to do and not waiting for an answer.
- Only when the change has none left to take, the project's next requirement.
- When every requirement of the change is delivered, `specgate archive` for
  it, unchanged.

Out of scope:

- The next step `specgate status` prints, which stays the project's queue.
- The order of requirements inside a change (tasks.md order, ADR-0035).

## Approach

`nextAfter` in `DoneCommand` first asks `nextRequirement` for the queue items
that belong to the owning change, then for the whole queue — the same rule for
what counts as next, narrowed to the change first.

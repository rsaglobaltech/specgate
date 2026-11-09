# Proposal: guard-next-requirement

## Intent

The guards of `agent-guards` (REQ-420…REQ-422) name the next requirement as
the first one not yet Implemented, in the order the deltas declare them. A
change's `tasks.md` often orders the work differently. On 2026-11-08, in
agentkit's change `module-map-v2`, `tasks.md` put REQ-320 next while the
guard's denial said "write the test for REQ-311 first"; the developer asked
why. The same denial reads as if only that requirement's test unlocks the
file, when a test naming any requirement of the change does. And when every
requirement of the open change is already Implemented, the denial names one
of them anyway.

## Scope

In scope:

- The next requirement, for the guard's denial and the session context, taken
  from the change's unchecked tasks in their order, then the delta's order.
- A denial that says any requirement of the change is a link.
- With every requirement applied, a denial that says to archive the change
  once its reviewer agrees, or to open a change for new work.

Out of scope:

- What the guard allows or denies: only its words change.
- The `Stop` gate.

## Approach

`project-state.ts` reads `tasks.md` beside the delta and orders the pending
requirements by the first unchecked task that names each; the guard and the
session hook use that order. The OpenCode plugin shares the module, so it
follows.

# ADR-0042 — The three layers of a change: Discover, Design, Tasks

## Status

Accepted — 2026-10-29. First change of the 1.0 line
([enterprise-sdd-gap.md](../enterprise-sdd-gap.md), item 2). Delivered by the
change `change-layers` (REQ-282..289).

## Context

At the scale of several teams a change is written by several people: product
says what the business needs and why, the architect how the system meets it,
the developer the work that delivers it. A 0.27 change is one `proposal.md`
that mixes the three, plus an optional `design.md` that has no owner and that
nothing checks. A reviewer cannot tell whether the business story moved when
the design did, nor whether the design answers what the business asked.

## Decision

1. **Three layers, each with its owner.** A new change follows the `layered`
   schema: `discover.md` (product: context, use case, numbered acceptance
   criteria `- AC-1: …`), `design.md` (architect: modules, mechanisms, channels,
   decisions) and `tasks.md` (developer: verifiable tasks naming their
   requirement), plus the delta specs. Each file states its owner on an
   `Owner:` line. `change status`, `change instructions` and the studio's
   review name the layer and its owner.
2. **`discover.md`, with `proposal.md` as the 0.27 Discover.** New changes write
   `discover.md`; every reader falls back to `proposal.md` when a change has no
   `discover.md`. Renaming every proposal would break every change in flight;
   keeping the name would leave a Discover indistinguishable from a proposal
   that mixes the layers. A change without `schema:` stays `spec-driven`.
3. **Rules, as warnings.** No technology in the Discover; the Design names every
   acceptance criterion; every task outside the specification tasks names a
   `REQ-NNN`; the Discover stays as it was agreed — at the commit that recorded
   the approval, or else its first commit. A change is written one layer at a
   time and `validate --strict` runs on every open change, so errors would fail
   the project's gate while the architect has not written the design;
   `change validate --strict` fails on them.
4. **A 0.27 change stays valid.** Its proposal is its Discover and the layer
   rules do not judge it; a missing `design.md` is a warning naming
   `specgate migrate 1.0`, which drafts one with `designFromProposal`.
5. **A draft has nothing to tick.** `propose --from-brief` and `--from-ticket`
   write the three layers; their `tasks.md` carries no checkbox until the draft
   is reviewed, and a layer still as it was scaffolded counts as not written.

## Consequences

- **Breaking:** `change new`, `propose`, `propose --from-brief` and
  `--from-ticket` no longer write `proposal.md`; a tool that read it reads
  `discover.md`, or both. `change new --schema spec-driven` keeps the 0.27
  layout.
- The studio, the harness prompts and `change show` read the Discover from
  either file.
- `alm pull` and pack contributions still open `spec-driven` changes; moving
  them is for the migration.

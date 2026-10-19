# ADR-0035 — Four verbs, one lifecycle

## Status

Proposed — 2026-10-19 (change `compact-use`)

## Context

Teams that compare Specgate with OpenSpec say the same thing: OpenSpec is
simple to use, Specgate is rigorous. OpenSpec's daily loop is three slash
commands — propose, apply, archive — and it has no test gate (its archive
accepts unchecked tasks). Specgate's gate is the reason to choose it, but a
developer meets, before the first green requirement:

- seven commands in the short help (`init`, `draft`, `status`, `new`, `add`,
  `check`, `done`) and 33 in the full one;
- two lifecycles. A brief's draft (ADR-0029) and a change (ADR-0015) are both
  archived **before** any code exists, so archived requirements land as
  `Draft` and are delivered later, one by one, through `done`;
- `archive` that means "the spec text is accepted", while OpenSpec's means
  "the work is finished".

Seen on agentkit (118 requirements, built with Specgate), in one day: three
archived spec changes needed a follow-up spec change once implementation
started — a scenario wording the strict gate refused (SCN-150), example IDs
the strict gate refused, and a GIVEN the existing tests could not meet.

## Decision

**One loop of four verbs over the existing gates: `propose` → `apply` →
`archive`, and `status`. A change is archived when its code is done.**

1. `propose` opens a change; `propose --from-brief` opens a draft from the
   brief. Same engines as `change new` and `draft`.
2. An open change's requirements are pending requirements while the change is
   in flight: `status`, `apply` and `check` read them from the delta. Nothing
   is written into the capability specs before archive.
3. `apply` delivers one requirement: no test naming it, refused; gate green,
   Implemented. `done` is its alias. There is no separate "mark done" step
   to forget.
4. `archive` merges the change only when every requirement it adds or modifies
   is Implemented. There is no flag that skips this.
5. The short help shows `init`, the four verbs and `check`. Every other command
   stays, behind `--help --all`.
6. Review is the pull request of the change; a person runs `archive`.

## Consequences

- The spec and the code of a change merge together, in one PR, after the gate
  passed. A test that disproves the spec text is fixed in the same change.
- ADR-0029's point 1 changes: a draft is still a change and never a spec, but
  it is archived after its requirements are applied, not before.
- `done` keeps working for scripts (REQ-111, REQ-115), so 0.20 pipelines do not
  break.
- The overlay (point 2) is new engine work: validation, status and the derived
  matrix read open deltas as well as capability specs.
- `change archive --force` no longer bypasses requirement delivery; it keeps
  bypassing only the task checklist.

## Alternatives considered

- **Keep archive first, rename only.** Cheaper, but keeps two meanings of
  "archive" and the second spec change when a test disproves the text.
- **Add `approve` as a fifth verb** (merge the spec text, then apply). Makes
  the accepted-but-unbuilt state explicit, at the cost of a fifth verb and
  the same double archive. Review already happens on the pull request.
- **Copy OpenSpec's archive without a gate.** Simple, and gives up the reason
  teams pick Specgate.

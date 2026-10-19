# Proposal: compact-use

## Intent

A developer who tries OpenSpec learns three commands — propose, apply,
archive — and is productive. Specgate shows seven commands in its short help,
33 in the full one, and two lifecycles: a brief's `draft` is archived before
any code exists, a `change` is archived the same way, and a requirement is
delivered by a separate `done`. The rigour is right; the surface makes people
pay for it up front.

This change keeps every gate and shrinks what a developer has to learn to one
loop of four verbs: **propose → apply → archive**, with **status** to see where
they are. `check` stays as the CI entry point. Everything else is still there,
behind `specgate --help --all`.

Decision record: [ADR-0035](../../adr/0035-four-verbs-one-lifecycle.md).

## Scope

In scope:

- `specgate propose` — opens a change (what `change new` does today), or, with
  `--from-brief`, a draft from the brief (what `draft` does today).
- An open change's requirements count while the change is in flight: `status`,
  `apply` and `check` see them before they are merged into the capability specs.
- `specgate apply` — one requirement at a time: refuses without a test that
  names it, runs the gate for it, and marks it Implemented when green. `done`
  becomes its alias.
- `specgate archive` — merges a change only when every requirement in it is
  Implemented. No bypass of that rule.
- The default help shows `init`, the four verbs and `check`; nothing else.
- Every refusal of these commands ends with one `fix:` line, and every one of
  them takes `--json`.
- The old names (`draft`, `change new`, `change archive`, `done`) keep working,
  unchanged for scripts, and their help names the new verb.

Out of scope:

- Derived traceability, false positives in strict mode, ID allocation, harness
  chains (milestone M2).
- Approval on record (M3, optional by decision 2026-10-19).
- Removing any existing command.

## Approach

The new verbs are thin: each one calls an engine that already exists
(`ChangeWorkspace`, `DraftCommand`, `DoneVerification`, `ArchiveChangeUseCase`).
The one engine change is the overlay — reading an open change's deltas as
pending requirements — which is what lets `archive` wait for the code instead
of coming before it.

Success measure: a developer new to Specgate takes a requirement from
`propose` to Implemented in under ten minutes using only `init`, `propose`,
`apply`, `archive` and `status` (REQ-116 checks the sequence; the time is
measured with the next pilot team).

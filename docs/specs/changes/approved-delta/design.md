# Design: approved-delta

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/DeltaSeal.ts` — pure: a requirement's seal from its delta text; what differs between two sets of seals (AC-1, AC-2, AC-3).
- `scripts/lib/approvals.ts` — `change approve` writes the seals beside the layers' records in `approvals.json`, at lite rigor too (AC-1); reading them back (AC-4).
- `scripts/lib/change-review.ts` (the gate's findings on open changes) — `approved_requirement_changed`, `approval_not_sealed` (AC-2, AC-4).

## Mechanisms

- A seal is the hash of one requirement's block in the delta — its heading, its statement, its scenarios — with the `specgate:trace` comment left out and whitespace at line ends ignored: `apply` writes the status there, and that is a delivery, not a change (AC-3).
- Seals are kept per requirement, so the gate names REQ-002 and says whether it changed, is new, or is gone, rather than "the delta changed" (AC-2).
- `approvals.json` gains one record, `{ layer: "requirements", seals: { "REQ-002": "sha256:…" }, by, at }`; the layers' records are as they were. A lite change with nothing written in its layers still gets that record.
- The gate is `validate --strict`, so `check`, `apply` and the harness all see it.
- Unsealed (AC-4): an approved change with no such record gives a warning and passes; `specgate change approve <id>` seals it.

## What this does not close

Whoever can run `specgate change approve` can seal anything. The rules say an agent never approves, and the harness refuses writes to the specification; a tool that approves its own commands outside the harness can still approve. Asking for a person at that command is a decision of its own, not taken here.

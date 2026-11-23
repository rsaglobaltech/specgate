# Design: trust-levels

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/gate-policy.ts` — reads `trust:` from `.specgate/gate.yaml`.
- `scripts/lib/trust.ts` (new) — the levels, what each allows, the ledger and the evidence.
- `scripts/harness/` — filters the queue by level before any worktree.
- `scripts/cli/commands/quality/ValidateSpecsCommand.ts` — the gate's findings.
- `scripts/cli/commands/trust.ts` (new) — `specgate trust`.
- `propose --kind bug` and `change approve` — write the ledger.

A module is a capability: the brief's modules are drafted as
`specs/<capability>/`, and every requirement belongs to one.

## Mechanisms

- AC-1 — `trust:` in `.specgate/gate.yaml` maps a capability to a level:
  1 observed, 2 confined, 3 verified, 4 unattended, 5 triage. Once the block
  exists, a capability it does not name is at 1. The gate fails
  `trust_invalid` for a level outside 1–5 (6, merging alone, is reserved for a
  later change) and `trust_unknown_capability` for a name that is no
  capability. No block: no finding, no enforcement — today's behaviour.
- AC-2 — before cutting worktrees, the harness drops each requirement its
  capability's level does not allow and reports it `skipped` with
  `trust_level`, the level and the level it needs:
  - 1 — never run by the harness; the agent works only with a person watching.
  - 2 — only a requirement named with `--req`, `--concurrency 1`.
  - 3 — every pending requirement of the capability, one at a time.
  - 4 — any `--concurrency`.
  - 5 — also the requirements of a change opened with `--kind bug`.
  - `--chain` needs 6: in a project with `trust:` it is refused
    (`harness_trust_chain`) until a later change makes 6 declarable.
- AC-3 — `.specgate/trust-ledger.jsonl`, one line per level change:
  capability, from, to, reason (`promotion` | `leak`), the change that carried
  it, the date. `specgate trust promote <capability>` opens the change
  `trust-<capability>-<to>` with the evidence written into its Discover;
  approving its layers appends the ledger line and writes the level. The
  first level a capability is declared at is recorded by the next `check` as
  `declared`: the team's starting point. After that, the gate fails
  `trust_raised_unapproved` when a capability's level in `gate.yaml` is above
  its last ledger line. Lowering by hand is always allowed and recorded by the
  next `check` as `lowered`.
- AC-4 — `propose --kind bug --capability <c>` appends a `leak` line and
  writes the level one lower, never below 1, in the same command.
- AC-5 — `apply` appends each requirement it delivers, gate passed, to
  `.specgate/applied.jsonl` (requirement, capability, date): the evidence a
  streak counts, shared by the team. `specgate trust [--json]`: per capability
  its level and name, its applied requirements, its green streak (applies and harness runs since its
  last leak, with no red attempt), its leaks, and `ready` when the streak
  reaches `trust.promote_after` (default 10) — with the command to propose it.

## Channels

None: files in the repository. The studio reads `specgate trust --json` to
show each module's level in Topo (a studio change).

## Decisions

ADR-0046. Rejected: one level for the whole project (a leak in one area would
stop all of them); levels that rise on their own from the evidence (the point
is a person deciding); declaring 6 now (merging alone waits until the other
levels have been used).

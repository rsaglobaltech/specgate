# ADR-0046 — Trust levels per module: earned with evidence, raised by a person, lowered by a bug

## Status

Proposed — 2026-11-23. Delivered by the change `trust-levels` (REQ-670..674).
Builds on the gate policy (ADR-0036), the harness (ADR-0037) and the approvals
per layer (ADR-0045).

## Context

The harness treats every area of a product alike: it runs unattended
everywhere, and `--chain` merges whatever is green. Teams that run agents at
scale earn that freedom step by step and per area — Lauren Tan's trust curve
for GrokBot: watch locally, controlled changes, independent verification,
unattended runs, error triage, merging alone. Specgate already ships each step
(the studio's Live view, `allow_paths`, `apply`, `harness run`, `--chain`) but
not the ladder: nothing says how far an agent may go in a given area, nothing
raises that on evidence, nothing lowers it when a bug escapes.

## Decision

1. **A level per module.** `trust:` in `.specgate/gate.yaml` maps a capability
   — the brief's module — to a level: 1 observed, 2 confined, 3 verified,
   4 unattended, 5 triage. Once the map exists, a capability it does not name
   is at 1. A project without it is untouched.
2. **The harness obeys it.** Each level allows a set of harness runs (REQ-671);
   whatever it does not allow is skipped and reported, never failed.
3. **Up only through a change.** `.specgate/trust-ledger.jsonl` records every
   level change. A rise is a change (`specgate trust promote`) carrying its
   evidence, approved by a person like any other; the gate fails a level
   raised by hand. The first declaration is the team's starting point.
4. **Down at once.** A bug change proposed for a capability lowers its level
   by one with no approval: losing trust must be cheaper than earning it.
5. **Evidence in view.** `specgate trust` shows each module's level, its green
   streak since its last leak, and when it is ready for a promotion.
6. **Merging alone waits.** Level 6 is not declarable yet; with `trust:` set,
   `--chain` is refused. It comes in a later change, once levels 1–5 have been
   used on real projects.

## Consequences

- A team can hand an area to agents without handing them all of it.
- Two more files in `.specgate/`: the policy's `trust:` block and the ledger.
- Later changes feed the evidence ([trust-curve.md](../trust-curve.md)):
  `specgate map` and an agent that navigates the app with it, stored evidence
  from `apply`, `specgate reproduce` (bugs entered as red scenarios),
  `specgate learn` (repeated review notes become principles) and `specgate
  eval` (skills measured on correct and on good code).
- The studio shows each module's level in Topo from `specgate trust --json`.

## Rejected

- One level for the whole project: a leak in one area would stop all of them.
- Levels that rise on their own from the evidence: the point is that a person
  decides.
- Declaring level 6 now: merging alone is the step with the most at stake.

# ADR-0021 — The ALM is a mirror; inbound work enters through a change

## Status

Accepted — 2026-08-20

## Context

`specgate alm sync` reconciles the traceability matrix with Jira or Azure Boards,
and ADR-0015's change lifecycle governs how a spec that already shipped is
modified. Nothing until now said how the two relate, and the question is not
academic: the first thing any team asks for after seeing `alm sync` is the
other direction — *"the product owner opens the ticket in Jira, make it appear
in the repo"*.

That request is reasonable and answering it carelessly ends the product. A
connector that can write requirements into the matrix makes the board a second
source of truth, and two sources of truth means neither is one. The value of
this tool is that `validate` can fail the build when a requirement has no
scenario and no test; a requirement that arrived from a ticket has neither, so
the first inbound sync would either break the gate or teach people to weaken
it.

There is also a shape problem that no amount of engineering removes. **A Jira
ticket does not contain an executable acceptance criterion.** It has a title, a
description and a status. Deriving Gherkin from it would be inventing the one
thing the spec exists to pin down — and §12.13 of the closure plan already
settled the equivalent question for brownfield code: documenting a system
produces prose nobody re-reads, whereas linking a requirement to code produces
a row the build breaks when it stops being true.

The port extracted in E0-02 raises the stakes, because adding a provider is now
a row in a registry. Whatever rule governs Jira governs YouTrack, Linear,
GitHub Issues and every provider after them, and it has to be written down
before the fifth one arrives rather than rediscovered by each.

The precedent already exists in this repository. `specops diff --as-change`
takes something from outside — a pack version bump — and lands it as a
**reviewable proposal** rather than as an accomplished fact. That is the shape
an inbound ALM flow has to take.

## Decision

**The ALM is a mirror. The spec tree is the contract.**

1. **Nothing under `scripts/alm/` writes to the spec tree.** `spec.md`,
   `docs/specs/**` and `features/**` are read-only to every provider and to the
   sync core. The single file the ALM subsystem writes is
   `.specops/alm-map.json`, the REQ ↔ issue mapping, which is a record of
   correspondence and not a statement about the system. This was already true;
   the ADR makes it a rule and `tests/unit/alm-conformance.test.ts` makes it a
   check, so a future provider cannot quietly acquire a write path.

2. **Drift is reported, never resolved.** An issue closed while its requirement
   is still open is a finding with an exit code, not something `sync` fixes.
   Reopening a requirement because a board says so would be the mirror deciding
   what the contract means.

3. **Status flows one way: matrix → board.** A requirement reaching a done
   status closes its issue. A closed issue never advances a requirement, since
   the only evidence that a requirement is done is its scenario passing, and
   the board has no opinion about that.

4. **Inbound work enters as a change, never as a matrix row.** When `alm pull`
   is built (E2-03), an ALM issue becomes a `change` with a proposal and a delta
   seeded from its title and description, and with **the scenarios left
   deliberately empty**. That gap is not an unfinished feature: it is the exact
   place where a human — or the `spec-author` role of the multi-agent harness —
   does the only work that cannot be automated. The change then goes through
   `change validate` and `change archive` like any other, so a ticket cannot
   become a requirement without passing the same gate as one written by hand.

5. **A provider may not widen this.** The `AlmProvider` port exposes three
   operations — create, read status, close. A provider needing to write into
   the spec tree to be useful is a provider this tool does not accept.

## Consequences

The honest cost: the tool will not, and will never, let a team drive delivery
from Jira alone. Someone has to write the acceptance criterion. Teams looking
for a board-to-code robot are not the buyer.

The gain is the one thing this tool sells. Because the board can never write a
requirement, `validate` remains able to say something true about the repository
regardless of how many systems are wired into it, and the number of connectors
becomes a distribution question instead of an architectural risk.

It also settles P1 (multi-repository orchestration, §12.12) without pretending
to solve it. The ALM issue is a usable identifier above the repository — that
is what a mirror is for — while remaining unable to define anything, which is
why using it that way is cheap rather than dangerous.

## Alternatives considered

**Bidirectional status sync.** Let the board reopen a requirement and let the
matrix close an issue. Symmetrical, familiar from ALM integrations generally,
and it produces two writers with no merge rule. The first disagreement is
unresolvable and the tool has no basis for choosing, because "done" in the
matrix means a scenario passed and "done" on a board means a person clicked.

**The ALM as the source of truth, the repo as its projection.** This is what
most enterprise integrations do, and it is coherent — it is simply a different
product, one where the gate cannot exist because requirements live somewhere
CI cannot verify.

**Import tickets straight into the matrix with a placeholder scenario.**
Fastest to demo and the worst of the options: it manufactures rows that satisfy
`validate` without describing behaviour, which converts the gate from a check
into a formality. ADR-0018 rejected phase gates for the same reason — a rule
that does not survive contact with real work gets satisfied with fiction.

**A webhook service so the board pushes in real time.** Requires a hosted
process with its own credentials and its own security surface. The CLI is
stateless and synchronisation belongs in CI, on a schedule, which is where it
already runs — the same reasoning that sent plugin distribution to v2 in D12.

# ADR-0027 — Use cases are a layer, not a column

## Status

Accepted — 2026-10-07

## Context

Specgate's unit is the requirement, and its traceability matrix is one row per
scenario. That row has a `Use Case` column, a `Command/Query` column and an
`Aggregate` column, each holding **one** value. The domain-pack schema says the
same thing another way: a use case has exactly one `requirement`.

That is a 1:1:1 model, and real projects are not shaped like it. A team that
works from use cases — the case that prompted this record: Jira epics and
stories, code organised by use case, some use cases modelled in BPMN —
describes three relations the matrix cannot hold:

- **One requirement, several use cases.** "A customer manages their profile"
  is realised by *Change password*, *Update photo* and *Change address*.
- **One use case, several requirements.** *Checkout* satisfies "VAT is computed
  per country", "stock is checked in real time" and "a receipt is emailed" at
  once.
- **Use cases that reuse each other.** *Buy product* and *Subscribe to premium*
  both `<<include>>` *Authenticate*; an `<<extend>>` adds an optional path.

And the kinds of requirement enter a use case through different doors:

- a **functional** requirement becomes the steps of its main and alternative flows;
- a **non-functional** one becomes a constraint on a step ("bank validation < 2 s");
- a **business rule** becomes a precondition, or the alternative flow that enforces it.

Two more facts shape the decision:

- **A user story is a slice of a use case**, not a requirement. The main flow
  ships in one sprint and the alternative flows in the next ones. Mapping a
  story to a `REQ`, as earlier drafts of the ALM integration assumed, is wrong.
- **Each path through a use case is a test.** The happy path, the validation
  error and the network failure are each a scenario — that is where BDD meets
  the use case.

Teams feel two different pains, and both are real: *"is what we promised
done?"* and *"what do I break if I touch this?"*. A table answers the first
badly and the second not at all.

At the same time, ADR-0022 holds: patterns are optional. Many of the same
team's projects use none of this, and a CRUD service must never be handed use
cases it does not have.

## Decision

**The requirement stays the unit of acceptance. The use case becomes an
optional layer of its own, related N:M to requirements, and the matrix becomes
a graph derived from both.**

1. **The elements.**

   | Element | Is | Present |
   |---|---|---|
   | Requirement `REQ-NNN` | What must hold, with a **kind**: `functional`, `non-functional` or `business-rule` | Always |
   | Use case `UC-NNN` | Actor, preconditions, main flow, alternative flows, `include`/`extend`, an *architecturally significant* flag | `layered` and `tactical-ddd` profiles |
   | Scenario `SCN-NNN` | One path through a use case — or through a requirement when there are no use cases | Always |
   | Story | A slice of a use case; it lives in the issue tracker | Never in the repository |
   | Entity | What a use case touches | `tactical-ddd` profile only |

2. **The N:M relation is declared on the use case**, which says which
   requirements it *realises*. The requirement stays stable and abstract; design
   happens in the use case; the reverse view is derived, exactly as the matrix is
   derived today. A requirement never lists its use cases.

3. **A use case is a Markdown file**, one per use case, under
   `docs/specs/use-cases/`, with fixed sections. On a codebase organised by use
   case, `init` proposes the skeletons from the folders, as it already proposes
   capabilities.

4. **With use cases, scenarios are written per path of a use case** and tagged
   with it. A requirement is covered *through* the use cases that realise it, so
   *Checkout*'s scenarios are written once, not once per requirement it
   satisfies. Projects without use cases keep tagging scenarios with the
   requirement, as today.

5. **The gate collects in both directions**, keeping ADR-0026's rule that a
   status is a promise and a `Draft` owes nothing:
   - a delivered requirement owes every use case that realises it, each with its
     paths covered by a test;
   - a use case that realises no requirement is **gold-plating**: a warning on
     adoption, an error under the strict profile;
   - a non-functional requirement owes a test tagged with it, or a stated reason
     it is verified elsewhere;
   - a business rule owes at least one alternative-flow scenario that exercises it;
   - an architecturally significant use case also owes the architecture check
     (ADR-0028).

6. **Profiles, not obligations.** ADR-0022's `minimal` profile is today's model,
   unchanged. `layered` — which already scaffolds `use-cases.md` — turns the
   use-case layer on. `tactical-ddd` adds entities and events. Each layer is
   additive: a project moves up a profile without migrating anything it has.

7. **The issue tracker mirrors, it does not define** (ADR-0021). An epic maps to
   a capability or a large use case; a story maps to one or more paths of a use
   case. Stories are not recorded in the repository: one source of truth for
   each thing.

## Consequences

- The matrix is no longer the model; it is one **view** of a graph. The graph
  answers "is it done?" by requirement and "what do I break?" by use case or
  entity. Both views are generated; nothing in them is edited by hand.
- The pack schema's `use_cases[].requirement` (one id) gains a
  `requirements` list. A pack that writes the single field keeps validating:
  the single value reads as a one-item list.
- `use-cases.md`, the one-table file `layered` scaffolds today, is superseded by
  one file per use case. Existing tables are migrated losslessly or not at all,
  the rule `matrix --migrate` follows.
- Two new commands earn a place outside the daily five: a trace view of one
  element and an impact view. The daily loop does not grow.
- The scope is larger than any change since the derived matrix. It ships in
  phases (the specification lists them), each behind the `layered` profile,
  so a `minimal` project sees no difference at any point.

## Alternatives considered

- **Comma-separated lists in the matrix cells.** The cheapest change and the
  worst one: unreadable at three values, and a merge conflict generator.
- **Declare the relation on the requirement.** Puts design inside the most
  stable artefact, and makes every new use case edit requirements it does not
  change.
- **Model stories in the repository.** A second source of truth for something
  the tracker already owns, and the first to drift.
- **Make use cases mandatory.** Contradicts ADR-0022, and is how this tool got
  its "hard to use" reputation.

## References

- [The use-case model — specification](../use-case-model.md)
- ADR-0021 — The ALM is a mirror; ADR-0022 — Patterns are optional;
  ADR-0026 — The default gate is the strong gate; ADR-0028 — Architecture
  conformance

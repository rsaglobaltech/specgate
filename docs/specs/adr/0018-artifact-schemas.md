# ADR-0018 — Artifact schemas: a dependency graph, not a phase gate

## Status

Accepted — 2026-08-15

## Context

A change produces artefacts — proposal, delta specs, design, tasks — and they
relate to each other: you cannot sensibly write tasks before you know what is
being built. The question is what that relationship *means*.

The instinct is to enforce it: refuse to create `tasks.md` until `specs/`
exists. That is a phase gate, and phase gates are the reason spec-driven
development gets a reputation for ceremony. It also does not survive contact
with real work, where the tasks are sometimes obvious before the design is.

## Decision

Model the artefacts as a **dependency graph**, and treat dependencies as
**enablers, not gates**.

```yaml
artifacts:
  - id: proposal
    generates: proposal.md
    requires: []
  - id: specs
    generates: specs/**/spec.md
    requires: [proposal]
  - id: design
    generates: design.md
    requires: [proposal]      # parallel with specs
  - id: tasks
    generates: tasks.md
    requires: [specs, design]
```

`specgate change status` reports each artefact as `done` · `ready` · `blocked` ·
`skipped`, in dependency order, and lists `nextSteps`. Nothing refuses to run
because an artefact is missing.

**`skipped` is a first-class state, not an absence.** A skipped artefact
satisfies its dependents without existing:

- `skip_specs: true` in `change.yaml` — a tooling change with no behavioural
  impact. `specs` is skipped and `tasks` still becomes ready.
- `rigor: lite` (the default) — `design` is skipped unless the author writes
  one anyway.

For this phase the `spec-driven` graph above is built in. Making it
configurable per schema (`specgate schema init | fork | validate | which`) is F3;
this ADR fixes the *model* so that work is a change of source, not of concept.

## Rationale

- **Enablers, not gates, is the whole difference between a workflow and
  bureaucracy.** The graph answers "what can I usefully write now?" — a
  question with a helpful answer — instead of "what am I forbidden from doing?"
- **`skipped` must satisfy dependents.** The alternative is that every lite
  change reports `tasks` as permanently blocked on a `design.md` nobody intends
  to write, which trains people to ignore `status` entirely.
- **Declaration order breaks ties.** When two artefacts become ready at once,
  they are reported in the order the schema declares, never alphabetically, so
  "the first `ready` entry" is a stable instruction an agent can follow.
- **`rigor: lite` as the default.** Most changes should stay lite. Full rigor —
  design decisions written down — is for cross-cutting work, contract changes,
  migrations and anything where ambiguity is expensive.

## Alternatives considered

1. **Enforce the order.** Rejected — see above. It also breaks the legitimate
   flow where a spike produces tasks first and the proposal is written to
   explain what the spike found.
2. **No graph at all; just a fixed list of files.** Rejected — then `status`
   cannot say anything more useful than "these files do not exist", and the
   configurable-schema work in F3 has nothing to build on.
3. **Treat a skipped artefact as missing but non-blocking.** Rejected — it
   makes `isPlanningComplete` unable to distinguish "deliberately not doing
   this" from "not done yet", which is the distinction the field exists for.
4. **Ship configurable schemas now.** Rejected for sequencing, not on merit:
   the built-in graph has to prove itself on real changes before its shape is
   frozen into a user-facing file format.

## Consequences

### Positive

- `change status` is a useful instruction rather than a checklist scold.
- An agent can drive the lifecycle from `status` alone: take the first `ready`
  artefact, write it, re-run.
- F3 becomes a matter of loading the graph from YAML instead of a constant.

### Negative / trade-offs

- The graph is hard-coded in `scripts/change/cli.ts` until F3. Anyone wanting a
  different workflow today has to fork the constant.
- Four states (`done`/`ready`/`blocked`/`skipped`) is more than a checkbox, and
  needs explaining once in the docs.
- Because nothing is enforced, a change can be archived with a thin proposal
  and no design. That is the intended trade: the gate that matters is
  `validate --strict-tdd` on the resulting requirement, not the paperwork.

## Follow-ups

- F3: `.specgate/schemas/<name>/schema.yaml`, `specgate schema init | fork | validate |
  which`, and a built-in `bdd-first` graph (`proposal → feature → spec → tasks`)
  for teams who want the executable scenario to lead.

## References

- `scripts/change/cli.ts` — `ARTIFACTS`, `artifactState`
- ADR-0015 — the lifecycle these artefacts belong to
- `mejoras/openspec-benchmark-plan.md` §F3

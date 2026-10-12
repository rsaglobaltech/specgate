# ADR-0022 — Patterns are optional; principles are not

## Status

Accepted — 2026-08-21

## Context

Every project this tool scaffolds is handed the tactical vocabulary of
Domain-Driven Design. `specgate init` writes `domain-model.md`, `use-cases.md`,
`commands.md`, `aggregates.md`, `events.md` and `status-model.md` whatever the
project is, and the generated `AI_RULES.md` tells the agent, before it writes a
line, that *every scenario maps to a use case, every use case to a command or
query, and every command to an aggregate or read model*.

For a payments engine that is good advice. For a static marketing site it is 74
lines of vocabulary describing structures the system does not have — and worse
than useless, because an agent reads them as a description of the system and
produces a `CreateInvoiceCommandHandler` for a contact form. That is accidental
complexity, manufactured by the scaffolder.

The uncomfortable part is that **the tool never actually required any of it.**
Measured: delete all five domain documents from a generated project and
`specgate validate` passes. The gate asks for stable requirement ids, an executable
scenario per requirement, a complete traceability matrix, legal statuses and —
under `--strict-tdd` — a test declared before work starts. Not one of those
mentions an aggregate. `use-cases.md` and `events.md` are checked only *if they
exist*, and then only for their table header.

So the obligation people feel does not come from the gate. It comes from two
softer places that are harder to see: the scaffolder, which creates the files
whether or not they fit, and the agent rulebook, which is prose no machine
verifies and every agent obeys. An option the generator always takes is not an
option.

The other half of this product already got the answer right.
`schemas/pack.schema.json` requires `requirements` and declares
`bounded_contexts`, `use_cases`, `commands`, `aggregates`, `value_objects` and
`events` **optional**, and `ExpandDomainPackCommand` already branches on it:

```ts
let mode = hasStructuredDomainModel(pack) ? "rich" : "legacy";
```

A pack with no domain model expands to the four-column matrix; one with a model
gets the ten-column matrix. The idea that a project may legitimately have no
aggregates is already implemented, tested and shipping — it simply never reached
`init`. The generated frontend row even carries `-` in Aggregate and Event, so
the format was never the thing insisting.

The industry position is not controversial: DDD earns its cost in complex,
long-lived domains with several teams, and is overkill for CRUD, prototypes and
short-lived work. Applying it by default is how a method acquires a reputation
for ceremony.

## Decision

**Architectural patterns are a choice the project declares. Architectural
principles are not, and the gate only ever enforces the second.**

1. **`validate` stays pattern-agnostic, and does not move.** No profile makes
   the gate weaker or stronger. A `minimal` project with a requirement lacking a
   scenario fails exactly as a `tactical-ddd` one does. This is what makes the
   rest of the ADR safe: the only thing holding the product up is untouched.

2. **A project declares an `ARCHITECTURE` profile**, and the scaffolder obeys
   it — the same mechanism `DOCKER_SUPPORT` and `DATASTORE` already use, down to
   rejecting combinations that cannot be true.

   | Profile | For | Domain documents | Matrix |
   |---|---|---|---|
   | `minimal` | scripts, landing pages, prototypes, CLIs | none | 4 columns |
   | `layered` | most work: CRUD APIs, frontends, services | `use-cases.md` | 10 columns, `-` where absent |
   | `tactical-ddd` | complex domains, several teams | all six | 10 columns |

3. **`AI_RULES.md` is generated per profile.** The pre-implementation gates that
   demand a command and an aggregate belong to `tactical-ddd` alone. What every
   profile keeps is the part that is not DDD at all: business logic stays out of
   the framework, and nothing is implemented without a traceability row.

4. **These principles are invariant across every profile**, and each is already
   enforced by the gate except the last:

   - every requirement has a stable id;
   - every requirement has an executable acceptance criterion — a Gherkin
     scenario, not prose;
   - traceability is complete, and the build fails when it is not;
   - a test is declared before a requirement moves past Draft (`--strict-tdd`);
   - the spec is the source of truth and the board is a mirror (ADR-0021);
   - decisions are recorded as ADRs;
   - **business logic does not live in framework code.** This one is
     separation of concerns, not DDD: a business rule inside an Express
     controller is equally wrong with or without aggregates. It survives when
     the aggregates go, because it is the value teams believe DDD is giving
     them.

5. **The profile is declared, never inferred.** Guessing it from `DOMAIN` or
   `STACK` — "banking, therefore DDD" — would be the original mistake wearing a
   different hat: the tool deciding the architecture for the team.

6. **Raising a profile is supported; lowering it is not automatic.** Going from
   `minimal` to `tactical-ddd` adds scaffolding. Going the other way would delete
   documents that may hold real content, so it is reported and left to a human.

7. **`doctor` reports drift between the declared profile and the project.** A
   `minimal` project with twelve aggregates in its model, or a `tactical-ddd`
   one whose `aggregates.md` has been empty for six months, is a finding. This
   is what turns the profile into something verifiable rather than a preference
   recorded once and forgotten.

## Consequences

The cost is three scaffolding paths instead of one, and two of them will be
exercised less than the default — met the way this repository meets it
elsewhere, with a test per profile that generates a project and validates it,
as already exists for Docker and the datastore.

The gain is that the method stops arguing with the project. A team that does not
need aggregates is no longer handed a document telling its agent to invent some,
and a team that does need them declares it and gets the full vocabulary. The
tool's opinion moves from *"model your domain this way"* to *"whatever you
model, it must be traceable and tested"* — which is the opinion it can actually
defend.

It also removes an inconsistency that was becoming a liability: packs already
treated the domain model as optional while projects did not, so the same
question had two answers depending on which half of the product you entered
through.

**The default is not changed by this ADR.** New projects continue to receive
`tactical-ddd` until a separate decision moves the default to `layered`, because
that change alters what an unchanged command produces and belongs to a major
release. Recording the reasoning now and changing the default later is
deliberate: the ADR is about what is possible, not about what arrives by
surprise.

## Alternatives considered

**Leave it, and document that the files are optional.** They already are
technically, and everyone still fills them in — because the generator writes
them and the rulebook demands them. Documentation does not undo a default.

**Relax `validate` for simpler projects.** The obvious reading of "make it
optional", and the wrong one. The gate is the product; it is also already
pattern-agnostic, so loosening it would break the working part to fix the
scaffolding.

**Drop the Aggregate and Event columns from the rich matrix.** They already
accept `-`, and removing them would break `done` and `alm/core`, which read
Status as the penultimate cell — the same fact that made E1-01 reject adding an
eleventh column.

**A profile per framework.** Spring gets one shape, Express another. This
confuses the shape of the problem with the shape of the tooling; a Spring CRUD
and an Express CRUD want the same profile.

**Infer the profile from the existing code during `adopt`.** Attractive, and
there is precedent in `pack infer`. It is also a guess that the project then
inherits silently, which is what principle 5 exists to prevent. It may return
later as an explicit *suggestion* the user confirms.

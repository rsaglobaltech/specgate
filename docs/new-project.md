# From a client brief to a running product

The path six real products took, from a client's brief to a product that runs
and a gate that holds it: a booking app, a credit shop, a core banking system,
an event-operations platform, a clinical-case manager and a field app for a
rebar crew. The same twelve steps every time. Three of them are yours and cannot be
delegated: reading the brief (1), reviewing each draft (8) and using the
product (12). The agent can run the rest.

The details of each step live in other guides; this one is the order.

## Once per project

### 1. Read the brief: separate what from how

A brief mixes what the system does with how to build it. Three of the six
briefs were mostly architecture: microservices, Kafka, event stores, CQRS. The
requirements come from the _what_; the _how_ is a technical decision. Agree the
scope before writing anything. In every pilot the agreement was to ignore the
infrastructure but deliver what it promised: "rebuild what happened" became a
requirement ("the agenda as it was at any date"), not a product to install.

### 2. Create the project

Specgate does not generate application code; it adopts a project that already
builds. Use your scaffold (forja for Next.js, the framework's own for Spring or
Quarkus), then `git init` and a repository.

### 3. Adopt Specgate

```bash
npx specgate init --no-capabilities        # a new project: no proposals from folders
npx specgate config set test_cmd "<cmd>"   # the tests `check` and `apply` run
npx specgate apply REQ-001                 # the adoption baseline
npx specgate ci init --provider github     # the same gate in CI: specification and tests
```

`init` detects the stack and proposes the test command (`npm test`,
`./mvnw -B test`, `./gradlew test`). In a Spring or Quarkus project keep one
test that boots the real application with no test doubles: in one pilot the
application did not start for a whole module while every test, and CI, were
green.

### 4. Keep the brief in the repository

Save it as `docs/brief.md`, unchanged, with a front matter that names the
product, who uses it and how, and the modules:

```markdown
---
product: Event operations
surfaces: [api]
actors:
  - { name: Organizer, surfaces: [api] }
  - { name: Attendee, surfaces: [api] }
modules: [events, registration, logistics, access, reports]
---
```

The actors decide what the checklist asks for, so check them: briefs rarely
name them (an "operator", a "merchant", a "privacy officer" were all inferred).
See [From a client brief](from-a-brief.md).

## Once per module

### 5. Open the draft

```bash
npx specgate propose --from-brief            # the brief's modules, and the next one
npx specgate propose --from-brief <module>   # opens it, linked to the brief, with DRAFTING.md
```

`specgate draft` is the older name of `specgate propose --from-brief`; both
work. Before the first module, `specgate propose --from-brief --check` checks
the brief itself: its fields, a section per module, rules with examples
([Write the brief](start/write-the-brief.md)).

One module per draft: a reviewer reads ten requirements, not sixty
(`--reserve 12` for a bigger one).

### 6. Write it

Tell your agent `Draft the <module> module: follow
docs/specs/changes/draft-<module>/DRAFTING.md` — or run
`specgate propose --from-brief <module> --agent "claude -p"`. The agent writes
`specs/<module>/spec.md` and two files next to it:

- **`assumptions.md`** — every value the brief does not give, and the
  requirements that use it (ids one by one or as ranges). Compute values before
  writing them: an IBAN, a card number or an ID letter made up by hand cost a
  red test in the pilots.
- **`questions.md`** — what only the client can answer, and what each question
  blocks. A proposal ("free shipping from 50 €, to validate") is an answer;
  "to be decided" is not.

Give every actor a scenario that **finds** what they later act on — the list
of pending transfers, of draft sessions, of results to review. It is the gap
every pilot found by running the product.

### 7. Check it

```bash
npx specgate propose --from-brief <module>
```

Twelve rules, D1–D12: a scenario per requirement and per surface, values that
come from somewhere, laws with their source, open questions that block, ids
that do not collide, and (D12) an actor who can get every id they act on. A
first pass usually has findings; each one is a sentence to add or a value to
declare. See the table in [From a client brief](from-a-brief.md#3-check-the-draft).

### 8. Review it — a person

The checklist sees the shape, not the business. Read the requirements, the
assumptions and the questions. Take the questions to the client and write
each answer in the `Answer` column.

A question that is not yours to answer stays open:

```markdown
<!-- specgate:trace actor=Operator kind=functional status="Needs Clarification" -->
```

The requirement then waits: `status` lists it under "Waiting for an answer",
`apply` refuses it and the harness will not build it. In the clinical pilot the
drug-interaction alerts stayed there — nobody may invent that table.

### 9. Build each requirement, test first

The reviewed draft stays an open change while you build it: `status` lists its
requirements and `apply` judges each as it will be after archive. The test
names the requirement and scenario (`REQ-012 SCN-018: …` in the test name):
that mention is the link. Then:

```bash
npx specgate apply REQ-012            # refused while no test names it, or the suite is red
# … the code …
npx specgate apply REQ-012 REQ-013    # several at once: the tests run once
```

Or let the agent do it: `npx specgate harness run`, one worktree per
requirement, the same gate.

### 10. Archive it

```bash
npx specgate archive draft-<module>
```

A draft is archived when its code is done: every requirement it adds is
Implemented, or `archive` refuses and names the next `specgate apply REQ-…`.
The requirements move to `docs/specs/capabilities/` and one feature file per
requirement is written (in Spanish when the scenarios are). A requirement still
waiting for an answer keeps the draft open; move it to a later change if the
rest should ship first.

### 11. Before every push

```bash
npx specgate check     # the specification, then the tests; CI runs the same
```

### 12. Use the product

Start it, the way a user would, after each module. The gate proves that what
the specification says is true; it cannot see what the specification does not
say. In the six pilots, running the product found:

- an action whose actor could not find what to act on (now D12),
- a requirement wider than its only scenario ("every error has this shape"),
- a production build or an application context that did not start,
- a privacy hole: a search that returned clinical data without a trace.

Each gap becomes a short change — `specgate propose <module>-2`, then steps 9
and 10. When the change rewrites a delivered requirement, put it under
`## MODIFIED Requirements` with all its scenarios and apply it again against
the new scenario: the change archives only once it is Implemented, and
archiving regenerates its feature file.

## The day to day, in short

```bash
npx specgate propose <change-id>   # a change: a delta to write, REQ ids reserved
npx specgate apply                 # the next requirement through the gate
npx specgate status                # what each requirement still needs, and what waits for an answer
npx specgate archive <change-id>   # once every requirement in it is Implemented
npx specgate check                 # the same gate, in CI
```

## The pilots

Each project page says what worked, what Specgate got wrong and what was fixed:

- [Rebar Crew](projects/rebar-crew.md) — the first product, before the draft checklist existed
- [Bookings](projects/bookings.md) — a detailed brief; the first draft checklist
- [Credit shop](projects/credit-shop.md) — a five-line brief: almost every value was an assumption
- [FinCore](projects/fincore.md) — Spring Boot; Specgate on a JVM stack
- [EventTech](projects/eventtech.md) — Quarkus, event sourcing, real time; D12's first use
- [HealthTech](projects/healthtech.md) — a regulated domain: what is not known waits for an answer

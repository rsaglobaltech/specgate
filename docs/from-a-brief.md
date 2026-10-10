# From a client brief to a spec

A project usually starts as a brief: a page, a document, a few screenshots.
This is the path from that page to requirements the gate and the harness can
work with — the one three products were built on, from briefs as different as
a detailed booking document and a five-line description of a credit shop.

## 1. Keep the brief in the repository

Save it as `docs/brief.md`, as the client wrote it. Add a front matter that
names who uses the product and how:

```markdown
---
product: Bookings for local businesses
surfaces: [api, web]
actors:
  - { name: Cliente, surfaces: [api, web] }
  - { name: Propietario, surfaces: [api, web] }
modules: [calendario, reservas, cupones]
---

# The brief, unchanged

…
```

If the brief has screenshots, describe what they show below it — values that
only appear in an image are otherwise invisible to the checklist.

## 2. Draft one module as a change

```bash
specgate change new draft-reservas --capability reservas --reserve 10
echo "brief: docs/brief.md" >> docs/specs/changes/draft-reservas/change.yaml
```

Write the delta under `specs/<capability>/spec.md` — by hand or with your
agent. Two files go next to it:

- **`assumptions.md`** — every value the brief does not give: prices, limits,
  button labels, status codes. A row names the requirements or scenarios that
  use it.
- **`questions.md`** — what the brief cannot answer, and the requirements each
  question blocks. A blocked requirement carries
  `status="Needs Clarification"` in its trace; the harness refuses it until
  someone answers.

## 3. Check the draft

```bash
specgate draft --check draft-reservas
```

| Code | Asks                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | every requirement has a scenario                                                                                                               |
| D2   | every requirement has a kind (`functional`, `non-functional`, `business-rule`)                                                                 |
| D3   | each actor's surfaces have a scenario of that actor — an API call and a screen. `surfaces=web` on a requirement narrows it (a menu has no API) |
| D4   | a non-functional requirement that promises a quantity states a number with a unit                                                              |
| D5   | a rule that cites a law, standard or contract names its source (`Source:` and a link)                                                          |
| D6   | every value in a scenario is in the brief, in the project's specification, or in `assumptions.md`                                              |
| D7   | every open question blocks a requirement, and that requirement waits                                                                           |
| D8   | the draft is small enough to review (25 requirements by default)                                                                               |
| D9   | every scenario passes the rules the harness gate will apply (titles, Given/When/Then)                                                          |
| D10  | no requirement or scenario id another requirement already owns                                                                                 |

D6 is the one that keeps a draft honest: on a vague brief it lists almost every
value, and that list is the conversation to have with the client.

An answered question gets an `Answer` column, or a line below the table such as
`Answer (Q1): free shipping from 50 €`; the requirement it blocked then drops
`Needs Clarification`.

## 4. Archive, then build

```bash
specgate change archive draft-reservas
```

Archiving merges the requirements into `docs/specs/capabilities/`, adds their
rows to the matrix and writes one feature file per requirement. New
requirements arrive as `Draft`, so the specification can merge before any code
exists. Then `specgate harness run` — or a person — delivers them one at a
time.

## Writing in Spanish

Write scenarios with `DADO / CUANDO / ENTONCES / Y`; the requirement body keeps
`SHALL` (or `DEBE`). Archiving writes Spanish Gherkin (`# language: es`,
`Característica`, `Escenario`), and every rule above reads both languages.

## What the checklist cannot see

It checks that a scenario exists for each surface, not that it asks for
everything. In every pilot, an action with only an API scenario — upload a
photo, add to cart — was built as an API with no button, and the gate stayed
green. Run the product once, by hand or headless, after each module: that is
where those gaps show, and each became a short follow-up change.

The design is [ADR-0029](specs/adr/README.md) and
[draft-from-brief](specs/draft-from-brief.md).

# From a client brief to a spec

A project usually starts as a brief: a page, a document, a few screenshots.
This is the path from that page to requirements the gate and the harness can
work with — the one the [six pilot products](projects/index.md) were built on, from briefs
as different as a detailed booking document and a five-line description of a
credit shop.

Steps 1 to 4 below are the _Specify_ phase of a requirement's life; the
harness and the gate take it from there.

<!-- specgate:diagram lifecycle -->

## 1. Keep the brief in the repository

Save it as `docs/brief.md`, as the client wrote it. Add a front matter that
names who uses the product and how — `specgate draft` explains every field and
checks them, and `specgate draft --agent "claude -p"` has your agent propose
them. Step by step: [Write the brief](start/write-the-brief.md).

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

## 2. Draft one module

```bash
specgate draft             # the brief's modules: where each stands, which is next
specgate draft reservas    # opens draft-reservas, linked to the brief
```

`specgate draft reservas` opens the draft — a change folder kept apart from
the specification until a person reviews it — and writes `DRAFTING.md` in it:
the module's scope, the reserved ids, a scenario per actor and surface from the
front matter, and the formats below. That file is the prompt. Tell your agent
`Draft the reservas module: follow docs/specs/changes/draft-reservas/DRAFTING.md`,
or let Specgate call it:

```bash
specgate draft reservas --agent "claude -p"
```

The prompt goes to the agent on standard input, or in a file when the command
contains `{prompt_file}`. Anything the agent writes outside the draft folder is
undone — a file you had changed returns to your version — and the draft is
checked when the agent finishes. In Claude Code, `/specgate:draft reservas`
does the same from inside the session.

The agent writes the delta under `specs/<module>/spec.md`, and two files go
next to it:

- **`assumptions.md`** — every value the brief does not give: prices, limits,
  button labels, status codes. A row names the requirements or scenarios that
  use it, one by one or as a range (`REQ-004..REQ-010`).
- **`questions.md`** — what the brief cannot answer, and the requirements each
  question blocks. A blocked requirement carries
  `status="Needs Clarification"` in its trace; the harness and `done` refuse
  it until someone answers, and `status` lists it under "Waiting for an
  answer" with the question that blocks it.

## 3. Check the draft

Run the same command again — on a draft that exists, it is the check:

```bash
specgate draft reservas
```

(`specgate draft --check <change-id>` runs the same checklist on any change.)

| Code | Asks                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | every requirement has a scenario                                                                                                               |
| D2   | every requirement has a kind (`functional`, `non-functional`, `business-rule`)                                                                 |
| D3   | each actor's surfaces have a scenario of that actor — an API call and a screen. `surfaces=web` on a requirement narrows it (a menu has no API) |
| D4   | a non-functional requirement that promises a quantity states a number with a unit                                                              |
| D5   | a rule that cites a law, standard or contract names its source (`Source:` and a link)                                                          |
| D6   | every value in a scenario is in the brief, the project's specification, `assumptions.md`, or its own sourced obligation                        |
| D7   | every open question blocks a requirement, and that requirement waits; "TBD" or "se decidirá" is not an answer                                  |
| D8   | the draft is small enough to review (25 requirements by default)                                                                               |
| D9   | every scenario passes the rules the harness gate will apply (titles, Given/When/Then)                                                          |
| D10  | no requirement or scenario id another requirement already owns                                                                                 |
| D12  | an actor who acts on an id (`…/{id}/…`) has a scenario that lists or creates it, or an assumption says where it comes from                     |

D6 is the one that keeps a draft honest: on a vague brief it lists almost every
value, and that list is the conversation to have with the client.

D12 catches what every pilot found only by running the product: each scenario
right on its own, and an operator who can settle a transfer by its id with no
way to see which transfers are pending. A `GET` on the collection by the same
actor, or the `POST` that creates it, closes it — in the draft or in the
project's specification — and so does a list nested under its parent with the
same name (`GET /api/eventos/{id}/sesiones` for `POST /api/sesiones/{id}/sala`).
The caller is the actor the step names before the call, else the
requirement's. When the id reaches the actor outside the API (a customer reads
their IBAN to the teller), or through a list under another name (an agenda),
say so in `assumptions.md`, in a row naming the requirement and the collection
path. A MODIFIED requirement also counts the rows of the archived change that
first wrote it. D11 is reserved: matching each API action with its screen
scenario is not mechanical yet.

D6 also accepts a value the requirement's own obligation states under a
`Source:` line: "24 characters" of a cited ISO norm needs no assumption row.

An answered question gets an `Answer` column, or a line below the table such as
`Answer (Q1): free shipping from 50 €`; the requirement it blocked then drops
`Needs Clarification`.

## 4. Archive, then build

```bash
specgate change archive draft-reservas
```

A change opened from a brief (`brief:` in `change.yaml`) is archived only when
its checklist passes; `--force` archives it anyway, and says so in review. A
draft has no `tasks.md` to tick: the checklist is its gate. Then
`specgate draft` names the next module.

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

It checks that a scenario exists for each surface, and (D12) that an actor can
reach the ids they act on, not that the draft asks for everything. In every pilot, an action with only an API scenario — upload a
photo, add to cart — was built as an API with no button, and the gate stayed
green. Run the product once, by hand or headless, after each module: that is
where those gaps show, and each became a short follow-up change.

The design is [ADR-0029](specs/adr/README.md) and
[draft-from-brief](specs/draft-from-brief.md).

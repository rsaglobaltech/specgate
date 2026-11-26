# From a client brief to a spec

A project usually starts as a brief: a page, a document, a few screenshots.
This is the path from that page to requirements the gate and the harness can
work with — the one the [six pilot products](projects/index.md) were built on, from briefs
as different as a detailed booking document and a five-line description of a
credit shop.

At the end you will have a **draft**, a change whose requirements were
written from the brief and checked against it, reviewed by a person and ready
to build. Steps 1 to 3 turn the brief into that draft; step 4 is the same loop
as any other change: a person approves it (`specgate change approve`),
`specgate apply` delivers each requirement through the gate, then
`specgate archive` merges the draft
([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).

**You need:** a project where Specgate is set up
([Getting started](getting-started.md)) and the client's brief. A coding agent
is optional but saves most of the writing.

Your work arrives as Jira stories with acceptance criteria rather than as a
brief? Use the ticket path instead: [From a Jira ticket](from-a-ticket.md).

<!-- specgate:diagram lifecycle -->

<!-- specgate:diagram brief-to-draft -->

## 1. Keep the brief in the repository

Save it as `docs/brief.md`, as the client wrote it. Add a front matter that
names who uses the product and how, and a section per module with its rules,
examples and questions. `specgate propose --from-brief` explains every field,
`specgate propose --from-brief --agent "claude -p"` has your agent propose the
fields and then the sections from the client's text, and
`specgate propose --from-brief --check` checks the brief before anything is
drafted. Step by step: [Write the brief](start/write-the-brief.md).

Two sections say what the modules do not. `## Why` gives the problem, the
objectives and a success you can measure — a Why with no number gets the
warning `B15_why_unmeasured`. `## Quality` says how well the product must
work, one line per need opened with its ISO/IEC 25010 characteristic —
`- performance efficiency (reservas): A slot is confirmed in under 2 seconds.`
— and each line becomes a non-functional requirement in the draft of the
module it names, or of the first module when it names none. A line no test
can check stops the draft (`B14_quality_unmeasured`). Step by step:
[Quality](start/write-the-brief.md#step-8-quality-3-minutes).

A tool that edits the brief as a form — specgate-studio — reads it with
`specgate propose --from-brief --form --json`, each field with its line, and
writes it back with `--form <file>`: only the fields and card lists that
changed are rewritten, every other byte of the file stays as it was.

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

## Module: reservas

Rules

- A slot is booked by one Cliente at a time.

Examples

- The one where Ana books the 10:00 slot of "Corte de pelo".

Questions

- Can a Cliente book two slots in a row?
```

## 2. Draft one module

```bash
specgate propose --from-brief            # the brief's modules: where each stands, which is next
specgate propose --from-brief reservas   # opens draft-reservas, linked to the brief
```

Opening a module creates the draft, a change folder kept apart from the
specification until a person reviews it: `change.yaml`, `discover.md`,
`design.md`, `tasks.md`, `use-cases.md`, the delta, and `DRAFTING.md`. That
file holds the module's section of the brief with its values and questions,
the reserved ids, a scenario to write per actor and surface from the front
matter, and the formats below. It is the prompt for your agent. Tell your agent
`Draft the reservas module: follow docs/specs/changes/draft-reservas/DRAFTING.md`,
or let Specgate call it:

```bash
specgate propose --from-brief reservas --agent "claude -p"
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
  `status="Needs Clarification"` in its trace; the harness and `apply` refuse
  it until someone answers, and `status` lists it under "Waiting for an
  answer" with the question that blocks it.

The same from the [studio](studio.md): its Brief section writes the brief as a
form, and its Changes section drafts each module in the background with the agent
you pick (`--profile <name>` in the terminal).

## 3. Check the draft

Run the same command again — on a draft that exists, it is the check:

```bash
specgate propose --from-brief reservas
```

(`specgate propose --from-brief --check <change-id>` runs the same checklist on
any change; `--check` alone checks the brief itself.)

| Code | Asks                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | every requirement has a scenario                                                                                                               |
| D2   | every requirement has a kind (`functional`, `non-functional`, `business-rule`)                                                                 |
| D3   | each actor's surfaces have a scenario of that actor — an API call and a screen. `surfaces=web` on a requirement narrows it (a menu has no API) |
| D4   | a non-functional requirement that promises a quantity states a number with a unit                                                              |
| D5   | a rule that cites a law, standard or contract names its source (`Source:` and a link)                                                          |
| D6   | every value in a scenario is in the brief, the project's specification, `assumptions.md`, or its own sourced obligation                        |
| D7   | every open question blocks a requirement, and that requirement waits ("none" says it blocks nothing); "TBD" or "se decidirá" is not an answer  |
| D8   | the draft is small enough to review (25 requirements by default)                                                                               |
| D9   | every scenario passes the rules the harness gate will apply (titles, Given/When/Then)                                                          |
| D10  | no requirement or scenario id another requirement already owns                                                                                 |
| D11  | reserved: not checked                                                                                                                          |
| D12  | an actor who acts on an id (`…/{id}/…`) has a scenario that lists or creates it, or an assumption says where it comes from                     |
| D13  | an assumption written from an answer (`specgate answer`) waits until its author says the requirements reflect it (`--reviewed`)              |
| D14  | every requirement names its use case (`uc=UC-NNN` in its trace), one `use-cases.md` lists, with the requirement in its row                     |
| D15  | each use case the draft adds or modifies has its specification, `use-cases/UC-NNN.md`, whose flows name the scenarios (`D15_no_spec`)          |
| D16  | a scenario's steps are in the project's language; a state machine the draft writes applies and holds                                           |

D6 is the one that keeps a draft honest: on a vague brief it lists almost every
value, and that list is the conversation to have with the client.

D12 catches a gap every pilot found only by running the product: each
scenario was right on its own, yet an operator could settle a transfer by its
id with no way to see which transfers were pending.

D12 is satisfied when the same actor has one of these, in the draft or in the
project's specification:

- a `GET` on the collection;
- the `POST` that creates the item;
- a list nested under its parent with the same name
  (`GET /api/eventos/{id}/sesiones` for `POST /api/sesiones/{id}/sala`);
- a row in `assumptions.md`, naming the requirement and the collection path,
  that says where the id comes from. Use it when the id reaches the actor
  outside the API (a customer reads their IBAN to the teller) or through a list
  under another name (an agenda).

The actor is the one the step names before the call, or else the
requirement's actor. For a `MODIFIED` requirement, the `assumptions.md` rows
of the archived change that first wrote it count too.

D6 also accepts a value the requirement's own obligation states under a
`Source:` line: "24 characters" of a cited ISO norm needs no assumption row.

### Answering a question

An answered question gets an `Answer` column (`Respuesta` works too), or a
line below the table such as `Answer (Q1): free shipping from 50 €`:

```markdown
| #   | Question                         | Blocks  | Answer               | Status   |
| --- | -------------------------------- | ------- | -------------------- | -------- |
| Q1  | From what amount is it free?     | REQ-004 | From 50 €, per order | answered |
| Q2  | Should it export a backup later? | none    |                      | open     |
```

Then, for each requirement the question blocked:

1. Remove `status="Needs Clarification"` from its `specgate:trace`. Nothing
   lifts it for you: the person who answered decides it is ready.
2. Write the answer into its text and scenarios, and record any value the brief
   still does not give as a row of `assumptions.md` naming the requirement.
3. Run `specgate propose --from-brief <module>` again until **Ready to review**.
4. If the draft was already approved, the requirement is no longer what was
   approved: `apply` refuses it (`approved_requirement_changed`) until a person
   runs `specgate change approve draft-<module>` again.

An answer that puts the decision off ("TBD", "pending", "se decidirá") leaves
the question open. A question nothing in the draft depends on says so with
`none` (or `—`, `ninguno`) in its Blocks column: it stays in `questions.md` as
a warning, and nothing waits for it. An empty Blocks cell is still refused. A
`Status` column is for the reader; the checklist reads the answer. The
studio, `specgate questions` and the checklist read an answer the same way —
the cell or the `Answer (Qn):` line — and the studio's **The spec says it**
lifts `Needs Clarification` from the requirements the question held once their
text says the answer.

## 4. Review, approve, apply, then archive

A draft is a change like any other, and its review is the pull request. Once
the checklist says **Ready to review**, a person reads the requirements and
`assumptions.md` with whoever knows the business, answers what they can, and
approves the draft at a terminal — an agent cannot (`approve_needs_person`).
Then the requirements are built one at a time:

```bash
specgate change approve draft-reservas   # a person, once it reads right; apply waits for it
specgate status                          # the draft's requirements, listed while it is open
specgate apply                           # the next one: refused until a test names it, then the gate
specgate archive draft-reservas          # once every requirement in it is Implemented
```

Approval refuses a requirement with no `kind=` in its trace
(`approve_blocked`), and writes the draft's feature files — one per
requirement, its scenarios ready to run before any code. `apply` refuses a
draft nobody approved (`change_not_approved`).

Leave a requirement in Draft until its test exists. Every status past Draft,
Approved included, owes a test under TDD-1, so `apply --status Approved`
refuses a requirement no test names; marked by hand, it would turn
`validate --strict`, and every harness gate, red for the whole project.

While the draft is open its requirements already count: `status` lists them,
`apply`, `check` and `harness run` judge the project as it will be after
archive, and `apply` writes each status into the trace comment of the
draft's delta (the matrix is regenerated from it). Nothing is written into
`docs/specs/capabilities/` before archive.

`archive` refuses while a requirement is still pending
(`archive_requirements_pending`, with `specgate apply REQ-…` as the fix), and
`--force` does not skip that. A change opened from a brief (`brief:` in
`change.yaml`) also needs its checklist to pass; `--force` skips only the
checklist, and says so in review. Unticked boxes in the draft's `tasks.md`
are only a warning (`archive_tasks_incomplete`).

Archiving merges the requirements into `docs/specs/capabilities/` and adds
their rows to the matrix; the feature files are already there from approval,
so it reports `0 materialised` — the spec and the code it describes land in
the same pull request. A test that disproves the
spec text is fixed in the same draft, not in a second change. Then
`specgate propose --from-brief` names the next module. `specgate harness run`
can deliver the requirements instead of a person, one per worktree.

## Writing in Spanish

Write scenarios with `DADO / CUANDO / ENTONCES / Y`; the requirement body keeps
`SHALL` (or `DEBE`). Approval writes Spanish Gherkin (`# language: es`,
`Característica`, `Escenario`), and every rule above reads both languages.

## What the checklist cannot see

It checks that a scenario exists for each surface, and (D12) that an actor can
reach the ids they act on, not that the draft asks for everything. In every
pilot, an action with only an API scenario (upload a photo, add to cart) was
built as an API with no button, and the gate stayed green. Run the product once, by hand or headless, after each module: that is
where those gaps show, and each became a short follow-up change.

The design is [ADR-0029](specs/adr/0029-a-brief-becomes-a-draft-change-not-a-spec.md)
and [draft-from-brief](specs/draft-from-brief.md).

## Next

- [Write the brief](start/write-the-brief.md) — the brief's front matter and sections, field by field
- [From a Jira ticket](from-a-ticket.md) — the same checks, with a Jira story as the source

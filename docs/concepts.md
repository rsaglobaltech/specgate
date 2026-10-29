# How Specgate thinks

Six ideas explain everything the CLI does. Read this once and every command,
error and flag has a reason you can predict.

## 1. A requirement is a sentence that can be wrong

A requirement lives in `spec.md` (or in a capability spec under
`docs/specs/`) as a numbered section:

```markdown
## REQ-007 — Customers download invoices as PDF

<!-- specgate:trace status=Implemented -->

A customer with a paid invoice MUST be able to download it as a PDF from the
invoice page, within two seconds, with the invoice number in the file name.
```

The prose is for people. The `specgate:trace` comment is for the tool — it holds
the status, and any link the tool cannot infer. You write the section in a
change's delta (`specgate propose`), or `specgate new` writes it in `spec.md`
with a draft sentence for you to rewrite; `specgate apply` records the status
when the gate passes.

A requirement is useful when two people could test it and agree on the
answer. "Invoices are easy to get" is a wish; the paragraph above is a
requirement.

## 2. A scenario makes it executable

Every requirement has at least one Gherkin scenario, tagged with its ids:

```gherkin
@REQ-007 @SCN-007
Scenario: A paid invoice downloads as a PDF
  Given a customer with a paid invoice INV-2041
  When they download it from the invoice page
  Then they receive "INV-2041.pdf" within 2 seconds
```

The scenario is the acceptance criterion. Gherkin, rather than prose, because a
runner can execute it — and because the gate can check things about it that it
cannot check about prose: that it has steps, that its keywords are ones
Cucumber recognises, that an `Outline` has `Examples`.

## 3. A mention is a link

There is nothing to declare. **A test or a source file that mentions
`REQ-007` is linked to it**:

```js
// REQ-007 SCN-007 — a paid invoice downloads as a PDF
test("a paid invoice downloads as a PDF", async () => { /* … */ });
```

That is the whole linking model. Rename the test and the link moves with it;
delete it and the requirement loses its test — which the gate then reports.

## 4. The matrix is generated, never edited

`docs/specs/traceability.md` is one row per scenario: requirement, scenario,
feature file, test, code, status. Every column is already said somewhere else,
so it is **computed** from those sources:

<!-- specgate:diagram traceability-chain -->

| Column | Comes from |
|---|---|
| Requirement, title | the `## REQ-NNN` sections in `spec.md` and capability specs |
| Scenario, feature file | `@REQ-NNN @SCN-NNN` tags in `features/**/*.feature` |
| Test, code | files that mention `REQ-NNN` |
| Status | the `specgate:trace` comment, written by `specgate apply` |

`specgate check` and `specgate apply` regenerate it before they judge.
`specgate validate` — what CI runs — fails with `matrix_stale` when the
committed copy no longer matches its sources. It stays committed because
people and tools read it; it just has no author.

## 5. A status is a promise, and the gate collects on it

The gate is strict, but it only asks a requirement for what its status
promises:

| Status | What it owes |
|---|---|
| `Draft` | Nothing — except that its scenarios cannot lie: no scenario without steps, no keyword Cucumber would read as prose, no `Outline` without `Examples`. |
| Past `Draft` (`Approved`, `In Dev`, `In Review`, …) | A test that mentions it (and, on a hand-kept matrix, a scenario id). |
| Delivered (`Implemented`, `Verified`, `Released`) | All of the above, plus every file it points at exists and its scenario has no `<placeholder>` steps. |
| `Deprecated` | Its files may be gone; nothing is owed. |

This is why the gate is green on the day you adopt it and means more with
every requirement you deliver. It is also why it never lies about its own
reach — a green run says how many rows were exempt:

```text
- Strict TDD gate: passed (3 row(s) exempt — still Draft, so not checked)
```

`specgate apply REQ-007` is how a requirement reaches a delivered status. It
refuses while no test names the requirement, then runs the gate for it: if the
gate would fail, nothing is written. (`--no-check` skips the gate, for the
rare case it is wrong — say so in the pull request.)

## 6. One gate, one name

There is exactly one gate: `validate --strict` on the specification, then
your architecture check, your tests and your [quality checks](quality.md) when
they are configured.
`specgate check` runs it, and so does everything else.

| Where | What runs |
|---|---|
| Your machine, before a PR | `specgate check` — the gate, then your tests if a test command is configured |
| Delivering a requirement | `specgate apply` — the gate for that requirement, then the status |
| CI | the job `specgate ci init` writes — `specgate check`, with the project's JDK or Node set up |
| An agent | the `/specgate:check` command, the `Stop` hook, the harness |

A gate that was slightly different in each place used to approve work in one
and fail it in the next. Now a green in one place is a green everywhere.

## Around the core

Three things build on those six ideas. The first is the daily loop; the
other two are not needed on day one.

**Changes.** New work and edits to what already shipped both go through a
change: a folder under `docs/specs/changes/<id>/` holding a proposal and a
delta, which lists only the requirements and scenarios that move, never a copy
of the spec. While it is open, its requirements count: `status` lists them,
`apply` delivers them one by one, `check` judges the project as it will be
after archive. `specgate archive <id>` merges it into the spec tree and writes
the feature files once every requirement in it is `Implemented`. A change is
archived when its code is done, on its branch, so the spec and the code land
in one pull request ([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).
→ [Change a shipped requirement](reviewing-changes.md)

**Layers.** A change has three, each with its owner: `discover.md`, product's —
what the business needs, its acceptance criteria, no technology; `design.md`,
the architect's — how, answering each criterion; `tasks.md`, the developer's —
the work, each task naming its requirement. Product reviews the story, the
architect the design, and the story stays put while the design changes
([ADR-0041](specs/adr/0041-the-three-layers-of-a-change.md)).

A change comes from one of three places:

| Source | Command | Guide |
|---|---|---|
| One behaviour you describe yourself | `specgate propose <change-id>` | [Propose one change](start/existing-2-specify.md) |
| A brief: a new product, or a large area of one | `specgate propose --from-brief` | [From a client brief](from-a-brief.md) |
| A Jira ticket with acceptance criteria | `specgate propose --from-ticket <KEY>` | [From a Jira ticket](from-a-ticket.md) |

A change from a brief or a ticket is a **draft**: it is checked against its
source text, and every value it uses must come from that text or be listed as
an assumption.

**Domain packs.** A versioned, schema-validated set of requirements and
scenarios for a domain (multi-tenancy, payments, …), installed like a
dependency, pinned by digest in `.specops.lock`, and upgraded through a
reviewable diff. → [Domain packs](domain-packs.md)

**The harness.** Hands one pending requirement at a time to any coding agent
in its own git worktree, runs the gate on the result, and marks the
requirement `Implemented` only when it passes. It never merges unless you ask
for a chain (`--chain`), and `specgate studio` shows it at work at `/live`.
→ [The harness](harness.md)

Before a change exists, `specgate explore` writes a brief of where the project
stands for you or your agent to think with; `specgate onboard --tour` runs the
whole loop on a temporary copy of your repository.
→ [Command reference](commands.md#starting-a-project)

## Vocabulary

| Term | Meaning |
|---|---|
| **Assumption** | A value a draft uses that its brief or ticket does not state (a price, a limit, a label), listed in the change's `assumptions.md` with the requirements that use it. |
| **Brief** | Your plan for a product, saved as `docs/brief.md`, with a short front matter naming the product, its actors, their surfaces and its modules. |
| **Capability** | One area of the product (orders, invoices, …). Its requirements live in `docs/specs/capabilities/<capability>/spec.md`. |
| **Change** | A folder under `docs/specs/changes/<id>/` holding work in progress: a proposal and a delta. Opened by `propose`, closed by `archive`. |
| **D-rules** | The drafting checklist (D1–D12) a draft from a brief must pass: a scenario per requirement and per surface, values with a source, open questions that block, and more. |
| **Definition of Ready** | The checks a Jira ticket must pass before it becomes a change: the T-rules. |
| **Delivered** | A status of `Implemented`, `Verified` or `Released`. |
| **Delta** | The part of a change that says what moves: the requirements and scenarios it adds, modifies or removes. |
| **Draft** | A change opened from a brief or a ticket, and checked against that source text before a person reviews it. Not to be confused with the status `Draft`, which a requirement has before work on it starts and which owes nothing to the gate. |
| **Gate** | `specgate check`: the specification checks (`validate --strict`), your architecture check if you set one, and your tests. `apply` runs it for one requirement; CI runs it on every pull request. |
| **Harness** | `specgate harness run`: hands each pending requirement to a coding agent in its own git worktree, runs the gate, and marks the requirement `Implemented` only when it passes. |
| **Pack** | A versioned domain model installed with `specgate specops add`. |
| **Question** / **Needs Clarification** | What a draft's source cannot answer, listed in the change's `questions.md`. A requirement a question blocks has the status `Needs Clarification`: `apply` and the harness refuse it until someone answers. |
| **Requirement** (`REQ-NNN`) | One obligation of the system, a numbered section in `spec.md` or a capability spec. |
| **Scenario** (`SCN-NNN`) | A Gherkin example that demonstrates a requirement, in `features/`. |
| **T-rules** | The ticket's Definition of Ready (T1–T9): acceptance criteria present, measurable and about behaviour, the ticket small enough, no open question, and more. |
| **Ticket** | A Jira story or bug used as the source text of a change: `specgate propose --from-ticket <KEY>`. |
| **Traceability matrix** | `docs/specs/traceability.md`: one row per scenario, linking requirement, scenario, feature file, test, code and status. Generated, never edited. |

## Next

- [Getting started](getting-started.md) — the four verbs on your repository
- [Your team's first pull request](first-pr.md) — author, reviewer, and every failure
- [Writing specs](writing-specs.md) — requirements and scenarios worth testing
- [Validating](validating.md) — every check the gate runs, flag by flag

# How Specgate thinks

Six ideas explain everything the CLI does. Read this once and every command,
error and flag has a reason you can predict.

---

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
rare case it is wrong — say so in the pull request. `done` is `apply`'s old
name.)

## 6. One gate, one name

There is exactly one gate: `validate --strict`. Everything runs it.

| Where | What runs |
|---|---|
| Your machine, before a PR | `specgate check` — the gate, then your tests if a test command is configured |
| Delivering a requirement | `specgate apply` — the gate for that requirement, then the status |
| CI | the job `specgate ci init` writes — `specgate check`, with the project's JDK or Node set up |
| An agent | the `/specgate:check` command, the `Stop` hook, the harness |

A gate that was slightly different in each place used to approve work in one
and fail it in the next. Now a green in one place is a green everywhere.

---

## Around the core

Three things build on those six ideas. The first is the daily loop; the
other two are not needed on day one.

**Changes.** New work and edits to what already shipped both go through a
change: `specgate propose <id>` opens a reviewable delta under
`docs/specs/changes/<id>/` — only what moves, never a copy. While it is open,
its requirements count: `status` lists them, `apply` delivers them one by
one, `check` judges the project as it will be after archive. `specgate
archive <id>` merges it into the spec tree and writes the feature files once
every requirement in it is `Implemented` — a change is archived when its code
is done, so the spec and the code land in one pull request
([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).
→ [Reviewing changes](reviewing-changes.md)

**Domain packs.** A versioned, schema-validated set of requirements and
scenarios for a domain (multi-tenancy, payments, …), installed like a
dependency, pinned by digest in `.specops.lock`, and upgraded through a
reviewable diff. → [Domain packs](domain-packs.md)

**The harness.** Hands one pending requirement at a time to any coding agent
in its own git worktree, runs the gate on the result, and closes the
requirement only when it passes. It never merges unless you ask for a chain
(`--chain`), and `specgate studio` shows it at work at `/live`.
→ [The harness](harness.md)

Before a change exists, `specgate explore` writes a brief of where the project
stands for you or your agent to think with; `specgate onboard --tour` runs the
whole loop on a temporary copy of your repository.
→ [Command reference](commands.md#starting)

---

## The vocabulary

| Term | Meaning |
|---|---|
| **Requirement** (`REQ-NNN`) | One obligation of the system, in `spec.md`. |
| **Scenario** (`SCN-NNN`) | A Gherkin example that demonstrates a requirement. |
| **Capability spec** | A `docs/specs/<capability>/spec.md` holding the requirements of one area. |
| **The matrix** | `docs/specs/traceability.md`, generated from the above. |
| **The gate** | `validate --strict`; `check` adds your tests. |
| **Delivered** | A status of `Implemented`, `Verified` or `Released`. |
| **Change** | A reviewable delta — new requirements or edits to shipped ones — opened by `propose`, archived once its requirements are applied. |
| **Pack** | A versioned domain model installed with `specgate specops add`. |
| **Harness** | The unattended plan → agent → gate → done loop. |

---

## Next

- [Getting started](getting-started.md) — the four verbs on your repository
- [Your team's first pull request](first-pr.md) — author, reviewer, and every failure
- [Writing specs](writing-specs.md) — requirements and scenarios worth testing
- [Validating](validating.md) — every check the gate runs, flag by flag

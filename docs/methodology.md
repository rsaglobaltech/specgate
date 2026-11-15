# The method

Specgate is a tool, and the tool encodes a way of working. This page is that
way of working: the principles behind it, the four phases a product goes
through, the two ways in, who does what, and where each artefact lives. Every
step names the command that does it; nothing here is advice the tool does not
enforce or produce.

<!-- specgate:note -->
**Spec-anchored, not spec-first.** The specification is not a prompt written
once and thrown away when the code exists, and the code is not regenerated
from it. It stays in the repository for the life of the system, next to the
code and the tests that prove it, and every change to the system changes it
first.
<!-- specgate:endnote -->

## Six principles

1. **The specification lives in the repository.** Numbered requirements with
   Gherkin scenarios, reviewed in pull requests like code, versioned with it.
   → [Concepts](concepts.md)
2. **Nothing is done until a test proves it.** A requirement is `Implemented`
   only when a test names it and the gate passes; `specgate apply` writes
   nothing otherwise. The same gate runs locally and in CI.
   → [Validating](validating.md)
3. **Ambiguity is asked, never guessed.** A draft from a brief or a ticket is
   held to its source text; every value nobody gave becomes an assumption or a
   question, and the requirement it blocks waits for the answer.
   → [From a client brief](from-a-brief.md)
4. **The specification changes first.** New work, a bug or an enhancement opens
   a change; the code follows the delta, never the other way round.
   → [Change a shipped requirement](reviewing-changes.md)
5. **The agent works inside the same rules.** It gets the same loop, a test
   before the code, a gate it cannot talk round, files it may not touch and
   decisions it must leave to a person. → [The harness](harness.md)
6. **The people who decide can read it.** A change becomes a page anyone can
   open; acceptance is signed by a person; the guide is written per actor.
   → [Review with the business](business-review.md)

A perfect specification is neither possible nor needed. What the method asks
for is a specification that can be **wrong** — every requirement concrete
enough to be checked — and a gate that says so the moment it is.

## Four phases

The phases overlap and repeat: a product is in all four at once, one change at
a time. What separates them is the question being answered.

| Phase | The question | What comes out of it | Commands |
| --- | --- | --- | --- |
| **Start** | What are we building, or what is already there? | A brief, its actors and modules; or the existing modules and a baseline | `init`, `propose --from-brief --new-brief`, `reverse --modules`, `check --baseline` |
| **Shape** | What exactly must it do, and what have we decided? | Requirements and scenarios in a change, answered questions, ADRs, the glossary and business rules | `propose`, `questions`, `answer`, `change approve`, `adr`, `stack`, `review` |
| **Build** | Does it do it? | Tests that name each requirement, code, a green gate | `status`, `apply`, `harness run`, `check` |
| **Hand over** | Does the business accept it? | The change archived into the specification, release notes, a signed acceptance, a guide per actor | `archive`, `release-notes`, `acceptance --sign`, `guide` |

### Start

For a new product, the client's brief is saved as `docs/brief.md`:
`specgate propose --from-brief --new-brief` writes one to fill in, and
`specgate propose --from-brief` names its modules and the next one to draft.
For a system that already runs, `specgate init` adopts the repository without
touching its code, `specgate reverse --modules` lists its modules, and
`specgate check --baseline` records today's findings so that only new ones fail.

### Shape

A change is opened — `specgate propose <id>`, `--from-brief <module>`,
`--from-ticket <KEY>`, or `specgate reverse <module>` for existing code — and
its delta holds the requirements it adds or modifies. Questions only the client
can answer go to the change's `questions.md` (`specgate questions`,
`specgate answer`). Decisions that outlive the change are recorded as ADRs
(`specgate adr new`), and what the agent may decide alone is written in
`docs/specs/decision-rights.md`. Words are fixed in the glossary, rules are
numbered `BR-NNN`. Before building, `specgate review <change>` gives the
people who decide one page to read, and `specgate change approve` records that
a person approved the draft.

### Build

`specgate status` names the next requirement. A test that names it comes
first; then the code; then `specgate apply`, which runs the gate for that
requirement and marks it `Implemented` only if it passes. The harness does the
same unattended: one requirement, one worktree, one agent — optionally a tester
and an implementer — and only what passes the gate is kept. `specgate check`
runs the whole gate before every pull request and in CI.

### Hand over

Once every requirement of a change is delivered, `specgate archive` merges it
into the specification, on its branch, so the spec and the code reach review in
one pull request. `specgate release-notes <from>..<to>` writes what changed for
the business, grouped by bug and enhancement. `specgate acceptance <change>`
writes a checklist per scenario; a person checks each item and signs with
`--sign`, and the change's `Implemented` requirements become `Verified`. `specgate guide`
writes a user guide per actor from what was delivered.

## Iterations

An iteration is a handful of changes taken from shaped to handed over.
Short is the point: the gate keeps the specification true at every step, so
nothing is saved up for the end — no big specification up front, and no
documentation sprint afterwards. Each iteration ends with the people who
decide reading the review page or the studio, and the next one starts from
their answers.

## Two ways in

<!-- specgate:cards cols=2 -->
- [A new product](from-a-brief.md) — The brief, its modules drafted one at a time, every invented value turned into a question, then build, archive and hand over.
- [A system that already runs](reverse.md) — Adopted without touching its code, one module reversed into Draft requirements that cite their source, the gate turned on with a baseline, and from then on every change goes through a change.
<!-- specgate:endcards -->

Work arriving as Jira tickets enters the same way, through
`specgate propose --from-ticket`. → [From a Jira ticket](from-a-ticket.md)

## Who does what

| Role | Does | Through |
| --- | --- | --- |
| Client or product owner | Answers questions, approves drafts, reads the review page, signs acceptance | `answer`, `change approve`, `review`, `acceptance --sign`, the studio |
| Analyst | Writes and reviews requirements, scenarios, the glossary, business rules and journeys | `propose`, deltas, `validate` |
| Developer | Writes the test first and the code, records decisions | `apply`, `check`, `adr` |
| Reviewer | Reads the delta, its scenarios and its tests in the pull request | the pull request |
| Agent | Drafts from a source, builds a requirement, asks when it may not decide | `propose --from-brief`, `reverse`, `harness run`, `ask` |

One person often holds several roles. In the studio served to a team, the
roles are enforced: a reader reads, an editor's changes arrive as pull requests,
an admin runs builds. → [The studio for a team](studio-team.md)

## Where each artefact lives

| Artefact | Where | Written or generated |
| --- | --- | --- |
| The brief | `docs/brief.md` | Written |
| Requirements | `spec.md`, `docs/specs/capabilities/<capability>/spec.md` | Written, through changes |
| Scenarios and journeys | `features/**/*.feature` | Scenarios written by archive from the deltas; journeys by hand |
| An open change | `docs/specs/changes/<id>/` — proposal, delta, `questions.md`, `acceptance.md` | Written |
| Traceability matrix | `docs/specs/traceability.md` | Generated from what the tests name, or kept by hand |
| Glossary | `docs/specs/glossary.md` | Written |
| Entity model, actors | `docs/specs/model.md`, `docs/specs/actors.md` | Generated |
| Decisions | `docs/specs/adr/`, `docs/specs/decision-rights.md`, `docs/specs/stack.md` | Written; the stack file generated, then kept |
| Gate baseline | `docs/specs/gate-baseline.json` | Generated by `check --baseline` |
| Review page | `<change>-review.html` | Generated |
| User guide | `docs/guide/<actor>.md` | Generated |
| Release notes | printed, or `--out <file>` | Generated |

## A requirement's life

`Draft` owes nothing yet; `Approved` and the statuses after it owe a test that
names the requirement; `Implemented` is set by `apply` once the gate passes;
`Verified` by a signed acceptance; `Released` when you mark it
(`specgate done <REQ> --status Released`); `Deprecated` owes nothing again. A
requirement waiting for the client is `Needs Clarification` and cannot be
closed by anyone until it is answered. → [A status is a promise](concepts.md#5-a-status-is-a-promise-and-the-gate-collects-on-it)

## Next

- [Start here](start.md) — two paths, a few commands each
- [Concepts](concepts.md) — the six ideas behind every command
- [Command reference](commands.md) — every command, grouped by job

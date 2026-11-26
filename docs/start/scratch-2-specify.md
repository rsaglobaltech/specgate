# From scratch · 2 — From the brief to a checked spec

> **The short version** of a new project, in six commands: [Start](../start.md). This page is the same step in detail, with recorded output.

<!-- specgate:goal -->
**When you finish:** one module of the client's brief drafted as requirements
and Gherkin scenarios, checked so that nothing in them is invented, and
reviewed by a person. The draft stays open as a change: its requirements are
built and applied in phases 3 and 4, and only then is it archived into the
specification.
<!-- specgate:endgoal -->

**Before you start:** [phase 1](scratch-1-install.md) is done, and the brief
is written — [Write the brief](write-the-brief.md) shows how.

A few words used on this page:

- **Change** — a folder under `docs/specs/changes/` that holds a piece of work
  until it is built: `discover.md` (why), `design.md` (how), `tasks.md`, and a
  **delta**, the requirements and scenarios it adds or modifies.
- **Draft** — a change opened from one module of the brief.
- **The checklist** — the drafting rules D1–D16 that `propose --from-brief`
  runs on a draft, each finding with its fix.

| Who | Does what in this phase |
| --- | --- |
| **You** | Put the brief in the repository, review the draft, decide what is an assumption and what is a question for the client |
| **Your agent** | Writes the first draft of one module |
| **The checklist** | Finds what the brief does not say: missing scenarios, invented values, unmeasured requirements |

## 1. Keep the brief in the repository

Save it as `docs/brief.md`, as the client wrote it — a plan you wrote yourself
works the same. A short front matter on top names the modules to draft one at
a time, and who uses the product through which surfaces; the checklist asks
for a scenario per actor and surface from it.

```markdown
---
product: Court bookings for a tennis club
surfaces: [api]
actors:
  - { name: Member, surfaces: [api] }
modules: [bookings]
---

# Brief

Members book a court for one hour. A court cannot be booked twice for
the same hour. Members can cancel a booking. Late cancellations may be charged.
```

## 2. See the modules

```bash
specgate propose --from-brief
```

<!-- specgate:out-scratch-draft-list:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief
  ◆ specgate · propose --from-brief   docs/brief.md

  Product   Court bookings for a tennis club
  Progress  ░░░░░░░░░░░░░░░░░░░░  0 of 1 archived

  Modules ────────────────────────────────────────────────
    ○ bookings  not started

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief bookings
```
<!-- specgate:out-scratch-draft-list:end -->

`specgate propose --from-brief` reads the brief and says where each module
stands and which one is next. Run it again whenever you are unsure what comes
next.

## 3. Open the module, and hand it to your agent

```bash
specgate propose --from-brief bookings
```

<!-- specgate:out-scratch-draft-open:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief bookings
  ◆ specgate · propose --from-brief bookings   docs/brief.md

  ✔  Draft draft-bookings opened · REQ ids REQ-002…REQ-011 reserved

    + docs/specs/changes/draft-bookings/DRAFTING.md                                     how to write it
    + docs/specs/changes/draft-bookings/specs/bookings/spec.md                          the requirements go here
    + docs/specs/changes/draft-bookings/change.yaml, discover.md, design.md, tasks.md   the layers

  Have your agent write it ───────────────────────────────
  Paste this into Claude Code, Cursor, Codex…

    Draft the bookings module: follow docs/specs/changes/draft-bookings/DRAFTING.md

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief bookings --agent "claude -p"
     or let Specgate call it — then run specgate propose --from-brief bookings until it says Ready to review
```
<!-- specgate:out-scratch-draft-open:end -->

The draft is a change named `draft-bookings`, linked to the brief and kept
apart from the specification until a person has reviewed it. It reserves the
requirement ids REQ-002 to REQ-011. `DRAFTING.md` inside it is the prompt for
your agent: the module's scope, the reserved ids, every actor and surface from
the front matter, and the formats the checklist reads. Paste the line the
command prints into Claude Code, Cursor, Codex or any other agent — or let
Specgate call the agent for you:

```bash
specgate propose --from-brief bookings --agent "claude -p"
```

The prompt goes to the agent on standard input (a command containing
`{prompt_file}` gets it in a file instead). Whatever the agent writes outside
the draft folder is undone afterwards — a file you had changed goes back to
your version, not the last commit — and the draft is checked as soon as the
agent finishes. Run `--agent` again on a draft with findings and the agent
gets those findings, with their fixes, in its prompt.

The draft on this page is the one the landing page shows: three requirements,
four scenarios — and a fee of 5 euros for a late cancellation that the client
never mentioned:

| Requirement | Its scenarios |
| --- | --- |
| REQ-002 — A member books a court for one hour | SCN-002 booking a free court · SCN-003 a member sees their bookings |
| REQ-003 — A court is never booked twice for the same hour | SCN-004 the second booking is refused |
| REQ-004 — A member cancels a booking | SCN-005 cancelling late is charged |

Your agent writes its own draft: the ids, the scenarios and the findings below
will differ. The draft also has `use-cases.md`: each requirement names its use
case (`uc=UC-002` in its trace, D14), and each use case gets its specification,
`use-cases/UC-002.md`, whose flows name the scenarios — without it the check
says `D15_no_spec`.

## 4. Check it — the same command, again

Once the draft exists, the same command checks it:

```bash
specgate propose --from-brief bookings
```

<!-- specgate:out-scratch-draft-check:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief bookings
  ◆ specgate · propose --from-brief bookings   docs/brief.md

  3 requirement(s) · 4 scenario(s)

  ✖  D6_unlisted_value  SCN-002 states "201", which is not in the brief and not listed as an assumption for SCN-002 or REQ-002.
     fix: List it in assumptions.md with SCN-002 (or REQ-002) in its row, or use the value the brief gives.
  ✖  D6_unlisted_value  SCN-004 states "court already booked", which is not in the brief and not listed as an assumption for SCN-004 or REQ-003.
     fix: List it in assumptions.md with SCN-004 (or REQ-003) in its row, or use the value the brief gives.
  ✖  D6_unlisted_value  SCN-004 states "409", which is not in the brief and not listed as an assumption for SCN-004 or REQ-003.
     fix: List it in assumptions.md with SCN-004 (or REQ-003) in its row, or use the value the brief gives.
  ✖  D6_unlisted_value  SCN-005 states "204", which is not in the brief and not listed as an assumption for SCN-005 or REQ-004.
     fix: List it in assumptions.md with SCN-005 (or REQ-004) in its row, or use the value the brief gives.
  ✖  D6_unlisted_value  SCN-005 states "5", which is not in the brief and not listed as an assumption for SCN-005 or REQ-004.
     fix: List it in assumptions.md with SCN-005 (or REQ-004) in its row, or use the value the brief gives.

  ✖  5 finding(s) to fix — each says how; DRAFTING.md has the formats

  What now ───────────────────────────────────────────────
   1  ➜ specgate propose --from-brief bookings --agent "claude -p"   your agent fixes them — or fix them yourself
   2  ➜ specgate propose --from-brief bookings   again, until it says Ready to review
```
<!-- specgate:out-scratch-draft-check:end -->

Every value a scenario states must be in the brief or written down as an
assumption: D6 flags each concrete value — a code, an amount, a name in quotes
— that the brief does not give. How many findings you get depends on the
draft; this one has five. Here the HTTP codes are a reasonable convention — an
**assumption** — but the fee is a business decision only the client can make —
a **question**. So you:

1. List the HTTP codes in `assumptions.md`, with the requirements they apply to.
2. Ask about the fee in `questions.md`, saying which requirement it blocks
   (`Q1 · REQ-004`).
3. Mark REQ-004 `status="Needs Clarification"` and write its scenario without
   the number.

Then check again:

```bash
specgate propose --from-brief bookings
```

<!-- specgate:out-scratch-draft-check-again:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief bookings
  ◆ specgate · propose --from-brief bookings   docs/brief.md

  3 requirement(s) · 4 scenario(s)

  ✔  Ready to review

  What now ───────────────────────────────────────────────
   1  Read docs/specs/changes/draft-bookings/specs/ with whoever knows the business
   2  Answer what you can in docs/specs/changes/draft-bookings/questions.md
   3  ➜ specgate change approve draft-bookings   you, at your terminal, once it reads right — apply waits for it
   4  ➜ specgate apply   its requirements, one at a time; then specgate archive draft-bookings
   5  ➜ specgate status   every module drafted: what to build first
```
<!-- specgate:out-scratch-draft-check-again:end -->

## 5. Review it — and leave it open

Read the draft with whoever knows the business, and answer what you can in
`questions.md`. Review happens in the draft's pull request; nothing is
archived yet. Once it reads right, a person approves it at their terminal —
`specgate change approve draft-bookings`, the first step of
[phase 3](scratch-3-build.md) and the next step `status` names below.

An open change's requirements are **in flight**: `status`, `check` and
`apply` read them from the change, and the gate judges them as they will be
once archived. You archive the change after its requirements are built and
applied, so the specification and its code reach review together
([phase 4](scratch-4-prove.md)).

## 6. See what is next

```bash
specgate status
```

<!-- specgate:out-scratch-status:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   court-bookings

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 3 done

  To do ──────────────────────────────────────────────────
    ○ REQ-002  A member books a court for one hour           a test and code
    ○ REQ-003  A court is never booked twice for the same …  a test and code

  ·  REQ-001 Preserve existing behaviour: your test suite holds it on every check.
     To close it, name REQ-001 in a test that starts the product.

  Waiting for an answer ──────────────────────────────────
    ○ REQ-004  A member cancels a booking  an answer to Q1
    Questions: Q1 (docs/specs/changes/draft-bookings/questions.md)

  Brief         ████████████████████  1 of 1 module(s) drafted   docs/brief.md

  Next ───────────────────────────────────────────────────
  ➜  specgate change approve draft-bookings
     draft-bookings waits for a person to approve it, at their terminal — apply delivers nothing before
```
<!-- specgate:out-scratch-status:end -->

REQ-004 is **waiting for an answer**: the harness will not build it and
`apply` will not deliver it until the client answers Q1. The answer changes
REQ-004, so a person approves the draft again before it is built. Nobody has to
remember that.

## You're done when…

- `specgate propose --from-brief bookings` says `✔  Ready to review` and a person has read the draft.
- `specgate status` lists its requirements, and the draft is still open.
- Every open question is in `questions.md`, and the requirement it blocks says so.

For the next module, `specgate propose --from-brief` names it; repeat steps
3–5. [From a brief](../from-a-brief.md) has the whole checklist (D1–D16) and
what each finding means.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `D6_unlisted_value … states "5", which is not in the brief` | A value nobody asked for | Use the brief's value, list it as an assumption, or turn it into a question |
| `No plan or brief at docs/brief.md. [draft_no_brief]` | The brief is somewhere else, or not saved yet | Save it as `docs/brief.md`, or pass `--brief <file>` |
| `Your brief does not list its modules yet.` | No `modules:` in the front matter | Paste the front matter it prints, or name the module: `specgate propose --from-brief bookings` |
| `The draft is still the placeholder.` | Nobody has written the draft yet | Paste the printed line into your agent, or use `--agent` |
| `--agent needs a git repository. [draft_agent_needs_git]` | Git is how the agent's writes are confined | `git init`, or paste the line into your agent yourself |
| `Scenario "<scenario name>" has placeholder steps, so it asserts nothing.` | A scenario was left as the template | Write what has to hold, or delete the scenario |

## Next

**[Phase 3 — build the first requirement →](scratch-3-build.md)**

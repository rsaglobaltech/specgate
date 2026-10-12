# From scratch · 2 — From the brief to a checked spec

**From scratch:** [1 Install](scratch-1-install.md) → **2 Specify** →
[3 Build](scratch-3-build.md) → [4 Prove](scratch-4-prove.md) →
[5 Every day](scratch-5-every-day.md) · 20–60 minutes per module

**Goal:** the client's brief becomes requirements and Gherkin scenarios that
a checklist has read — so nothing in them is invented — and they are merged
into `spec.md`, one module at a time.

| Who               | Does what in this phase                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **You**           | Put the brief in the repo, review the draft, decide what is an assumption and what is a question for the client          |
| **Your agent**    | Writes the first draft of one module                                                                                     |
| **The checklist** | `specgate draft <module>` finds what the brief does not say: missing scenarios, invented values, unmeasured requirements |

## 1. Keep the brief in the repository

Save it as `docs/brief.md`, as the client wrote it — a plan you wrote
yourself works the same. [Write the brief](write-the-brief.md) walks through it
step by step, including letting your agent propose the front matter. A short front matter names the modules to draft one
at a time, and who uses the product through which surfaces; the checklist asks
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

## 2. See the modules — `specgate draft`

```bash
specgate draft
```

<!-- specgate:out-scratch-draft-list:begin — generated; edit the source, not this block -->
```text
$ specgate draft
  ◆ specgate · draft   docs/brief.md

  Product   Court bookings for a tennis club
  Progress  ░░░░░░░░░░░░░░░░░░░░  0 of 1 archived

  Modules ────────────────────────────────────────────────
    ○ bookings  not started

  Next ───────────────────────────────────────────────────
  ➜  specgate draft bookings
```
<!-- specgate:out-scratch-draft-list:end -->

`specgate draft` reads the brief and says where each module stands and which
one is next. You will run it again whenever you are unsure what comes next.

## 3. Open the module, and hand it to your agent

```bash
specgate draft bookings
```

<!-- specgate:out-scratch-draft-open:begin — generated; edit the source, not this block -->
```text
$ specgate draft bookings
  ◆ specgate · draft bookings   docs/brief.md

  ✔  Draft draft-bookings opened · REQ ids REQ-002…REQ-011 reserved

    + docs/specs/changes/draft-bookings/DRAFTING.md                how to write it
    + docs/specs/changes/draft-bookings/specs/bookings/spec.md     the requirements go here
    + docs/specs/changes/draft-bookings/change.yaml, proposal.md

  Have your agent write it ───────────────────────────────
  Paste this into Claude Code, Cursor, Codex…

    Draft the bookings module: follow docs/specs/changes/draft-bookings/DRAFTING.md

  Next ───────────────────────────────────────────────────
  ➜  specgate draft bookings --agent "claude -p"
     or let Specgate call it — then run specgate draft bookings until it says Ready to review
```
<!-- specgate:out-scratch-draft-open:end -->

That is the whole setup. The draft is a folder of proposed requirements, kept
apart from `spec.md` until a person has reviewed it, and linked to the brief.
`DRAFTING.md` inside it is the prompt: the module's scope, the reserved ids,
every actor and surface from the front matter, and the formats the checklist
reads. Paste the line it prints into Claude Code, Cursor, Codex or any other
agent — or let Specgate call the agent for you:

```bash
specgate draft bookings --agent "claude -p"
```

The prompt goes to the agent on standard input (a command containing
`{prompt_file}` gets it in a file instead). Whatever the agent writes outside
the draft folder is undone afterwards — a file you had changed goes back to
your version, not the last commit — and the draft is checked as soon as it
finishes.
In Claude Code, `specgate agents init` also gives you `/specgate:draft bookings`.

The draft on this page is the one the landing page shows: three requirements,
four scenarios — and a fee of 5 euros for a late cancellation that the client
never mentioned.

## 4. Check it — the same command, again

```bash
specgate draft bookings
```

<!-- specgate:out-scratch-draft-check:begin — generated; edit the source, not this block -->
```text
$ specgate draft bookings
  ◆ specgate · draft bookings   docs/brief.md

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
   1  ➜ specgate draft bookings --agent "claude -p"   your agent fixes them — or fix them yourself
   2  ➜ specgate draft bookings   again, until it says Ready to review
```
<!-- specgate:out-scratch-draft-check:end -->

Every value a scenario states must be in the brief or written down as an
assumption. Here the HTTP codes are a reasonable convention — an
**assumption** — but the fee is a business decision only the client can make —
a **question**. So you:

- list the HTTP codes in `assumptions.md`, with the requirements they apply to;
- ask the fee in `questions.md`, saying which requirement it blocks (`Q1 · REQ-004`);
- mark REQ-004 `status="Needs Clarification"` and write the scenario without the number.

```bash
specgate draft bookings
```

<!-- specgate:out-scratch-draft-check-again:begin — generated; edit the source, not this block -->
```text
$ specgate draft bookings
  ◆ specgate · draft bookings   docs/brief.md

  3 requirement(s) · 4 scenario(s)

  ✔  Ready to review

  What now ───────────────────────────────────────────────
   1  Read docs/specs/changes/draft-bookings/specs/ with whoever knows the business
   2  Answer what you can in docs/specs/changes/draft-bookings/questions.md
   3  ➜ specgate change archive draft-bookings
   4  ➜ specgate status   every module drafted: what to build first
```
<!-- specgate:out-scratch-draft-check-again:end -->

## 5. Review it, then archive it into the specification

Read the draft with whoever knows the business, answer what you can in
`questions.md`, then:

```bash
specgate change archive draft-bookings
```

<!-- specgate:out-scratch-archive:begin — generated; edit the source, not this block -->
```text
$ specgate change archive draft-bookings
  ◆ specgate · change archive   draft-bookings

  ✔  Archived as 2026-01-01-draft-bookings

    Specs         3 added · 0 modified · 0 removed
    Traceability  3 row(s) added · 0 updated · 0 removed
    Features      3 materialised

  Next ───────────────────────────────────────────────────
  ➜  specgate draft
     the next module of the brief, or what to build first
```
<!-- specgate:out-scratch-archive:end -->

The requirements are now in the specification as `Draft`: written down,
not yet owed. A Draft requirement costs the gate nothing until someone starts
closing it.

## 6. See what is next

```bash
specgate status
```

<!-- specgate:out-scratch-status:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   court-bookings

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 4 done

  To do ──────────────────────────────────────────────────
    ○ REQ-001  Preserve existing behaviour                   a test and code
    ○ REQ-002  A member books a court for one hour           a test and code
    ○ REQ-003  A court is never booked twice for the same …  a test and code

  Waiting for an answer ──────────────────────────────────
    ○ REQ-004  A member cancels a booking  an answer to Q1
    Questions: Q1 (docs/specs/changes/archive/2026-01-01-draft-bookings/questions.md)

  Brief         ████████████████████  1 of 1 module(s) drafted   docs/brief.md

  Next ───────────────────────────────────────────────────
  ➜  specgate done REQ-002
     once a test mentions REQ-002 — that mention is the link; done checks first
```
<!-- specgate:out-scratch-status:end -->

REQ-004 is **waiting for an answer**: the harness will not build it and `done`
will not close it until the client answers Q1. Nobody has to remember that.

<!-- specgate:note -->

**By hand.** `specgate draft bookings` is `specgate change new draft-bookings
--capability bookings`, plus `brief: docs/brief.md` in its `change.yaml`, plus
`DRAFTING.md`; and every later run is `specgate draft --check draft-bookings`.
Both forms keep working.
<!-- specgate:endnote -->

## You're done when…

- `specgate draft bookings` says `✔  Ready to review.` and a person has read the draft.
- `change archive` has merged it, and `specgate status` lists the requirements.
- Every open question is in `questions.md`, and the requirement it blocks says so.

Then `specgate draft` names the next module; repeat steps 3–5. The [brief guide](../from-a-brief.md) has
the full checklist (D1–D12) and what each finding means.

## If something goes wrong

| You see                                                                    | It means                                      | Do                                                                          |
| -------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `D6_unlisted_value … states "5", which is not in the brief`                | A value nobody asked for                      | Use the brief's value, list it as an assumption, or turn it into a question |
| `No plan or brief at docs/brief.md. [draft_no_brief]`                      | The brief is somewhere else, or not saved yet | Save it as `docs/brief.md`, or pass `--brief <file>`                        |
| `Your brief does not list its modules yet.`                                | No `modules:` in the front matter             | Paste the front matter it prints, or run `specgate draft <module>` directly |
| `The draft is still the placeholder.`                                      | Nobody has written the draft yet              | Paste the printed line into your agent, or use `--agent`                    |
| `--agent needs a git repository. [draft_agent_needs_git]`                  | Git is how the agent's writes are confined    | `git init`, or paste the line into your agent yourself                      |
| `Scenario "<scenario name>" has placeholder steps, so it asserts nothing.` | A scenario was left as the template           | Write what has to hold, or delete the scenario                              |

**[Next: phase 3 — build the first requirement →](scratch-3-build.md)**

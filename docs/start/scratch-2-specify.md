# From scratch · 2 — From the brief to a checked spec

**From scratch:** [1 Install](scratch-1-install.md) → **2 Specify** →
[3 Build](scratch-3-build.md) → [4 Prove](scratch-4-prove.md) →
[5 Every day](scratch-5-every-day.md) · 20–60 minutes per module

**Goal:** the client's brief becomes requirements and Gherkin scenarios that
a checklist has read — so nothing in them is invented — and they are merged
into `spec.md`, one module at a time.

| Who | Does what in this phase |
| --- | --- |
| **You** | Put the brief in the repo, review the draft, decide what is an assumption and what is a question for the client |
| **Your agent** | Writes the first draft of one module |
| **The checklist** | `draft --check` finds what the brief does not say: missing scenarios, invented values, unmeasured requirements |

## 1. Keep the brief in the repository

Save it as `docs/brief.md`, as the client wrote it. A short front matter names
who uses the product and through which surfaces; the checklist asks for a
scenario per actor and surface from it.

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

## 2. Open a change for one module

```bash
specgate change new draft-bookings --capability bookings
```

<!-- csda:out-scratch-change-new:begin — generated; edit the source, not this block -->
```text
$ specgate change new draft-bookings --capability bookings
  ✔ Change draft-bookings created (lite · REQ ids REQ-002…REQ-004 reserved)

    + docs/specs/changes/draft-bookings/change.yaml
    + docs/specs/changes/draft-bookings/proposal.md
    + docs/specs/changes/draft-bookings/tasks.md
    + docs/specs/changes/draft-bookings/specs/bookings/spec.md

  Next: write the proposal, then the delta, then specgate change validate draft-bookings
```
<!-- csda:out-scratch-change-new:end -->

A change is a folder of proposed requirements, kept apart from `spec.md` until
it is reviewed. One module per change keeps it small enough to read in one
sitting; `--reserve 10` reserves more ids for a bigger module.

## 3. Your agent drafts it

Ask your agent to write the requirements and scenarios for the module, in
`docs/specs/changes/draft-bookings/specs/bookings/spec.md`, from the brief —
or have Specgate hand it the job, confined to the change folder:

```bash
specgate change author draft-bookings --artifact specs --agent "claude -p < {prompt_file}"
```

The draft on this page is the one the landing page shows: three requirements,
four scenarios — and a fee of 5 euros for a late cancellation that the client
never mentioned.

## 4. Check the draft against the brief

```bash
specgate draft --check draft-bookings --brief docs/brief.md
```

<!-- csda:out-scratch-draft-check:begin — generated; edit the source, not this block -->
```text
$ specgate draft --check draft-bookings --brief docs/brief.md
  specgate draft --check draft-bookings

  3 requirement(s), 4 scenario(s)

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

  ✖  5 finding(s) to fix before review.
```
<!-- csda:out-scratch-draft-check:end -->

Every value a scenario states must be in the brief or written down as an
assumption. Here the HTTP codes are a reasonable convention — an
**assumption** — but the fee is a business decision only the client can make —
a **question**. So you:

- list the HTTP codes in `assumptions.md`, with the requirements they apply to;
- ask the fee in `questions.md`, saying which requirement it blocks (`Q1 · REQ-004`);
- mark REQ-004 `status="Needs Clarification"` and write the scenario without the number.

```bash
specgate draft --check draft-bookings --brief docs/brief.md
```

<!-- csda:out-scratch-draft-check-again:begin — generated; edit the source, not this block -->
```text
$ specgate draft --check draft-bookings --brief docs/brief.md
  specgate draft --check draft-bookings

  3 requirement(s), 4 scenario(s)


  ✔  Ready to review.
```
<!-- csda:out-scratch-draft-check-again:end -->

## 5. Archive it into the specification

Tick the change's `tasks.md`, then:

```bash
specgate change archive draft-bookings
```

<!-- csda:out-scratch-archive:begin — generated; edit the source, not this block -->
```text
$ specgate change archive draft-bookings
  ✔ Archived as 2026-01-01-draft-bookings

    specs:        3 added · 0 modified · 0 removed
    traceability: 3 row(s) added · 0 updated · 0 removed
    features:     3 materialised

  Now run specgate validate . --strict — it will fail until the tests exist.
```
<!-- csda:out-scratch-archive:end -->

The requirements are now in the specification as `Draft`: written down,
not yet owed. A Draft requirement costs the gate nothing until someone starts
closing it.

## 6. See what is next

```bash
specgate status
```

<!-- csda:out-scratch-status:begin — generated; edit the source, not this block -->
```text
$ specgate status
  📊 Project status  court-bookings

  Requirements  4 total · 0 done · 4 pending

  To do
    REQ-001   Preserve existing behaviour                   a test and code
    REQ-002   A member books a court for one hour           a test and code
    REQ-003   A court is never booked twice for the same …  a test and code

  Waiting for an answer
    REQ-004   A member cancels a booking                    an answer to Q1
    Questions: Q1 (docs/specs/changes/archive/2026-01-01-draft-bookings/questions.md)

  Next  specgate done REQ-002  — once a test mentions REQ-002 — that mention is the link; done checks first
```
<!-- csda:out-scratch-status:end -->

REQ-004 is **waiting for an answer**: the harness will not build it and `done`
will not close it until the client answers Q1. Nobody has to remember that.

## You're done when…

- `draft --check` says `✔  Ready to review.` and a person has read the draft.
- `change archive` has merged it, and `specgate status` lists the requirements.
- Every open question is in `questions.md`, and the requirement it blocks says so.

Repeat steps 2–5 for the next module. The [brief guide](../from-a-brief.md) has
the full checklist (D1–D12) and what each finding means.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `D6_unlisted_value … states "5", which is not in the brief` | A value nobody asked for | Use the brief's value, list it as an assumption, or turn it into a question |
| `draft_rule_skipped  D6 did not run: no brief given.` | No brief to compare with | Pass `--brief docs/brief.md`, or add `brief:` to the change's `change.yaml` |
| `Change "…" still has 3 unchecked task(s). [archive_tasks_incomplete]` | `tasks.md` is not ticked | Finish the tasks, then archive |
| `Scenario "<scenario name>" has placeholder steps, so it asserts nothing.` | A scenario was left as the template | Write what has to hold, or delete the scenario |

**[Next: phase 3 — build the first requirement →](scratch-3-build.md)**

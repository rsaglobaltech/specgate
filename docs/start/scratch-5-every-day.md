# From scratch · 5 — Every day

**From scratch:** [1 Install](scratch-1-install.md) → [2 Specify](scratch-2-specify.md) →
[3 Build](scratch-3-build.md) → [4 Prove](scratch-4-prove.md) →
**5 Every day** · 10 minutes, once

**Goal:** the gate on every pull request, and a daily loop short enough to
remember — five commands, none of which asks you to edit a matrix.

| Who | Does what in this phase |
| --- | --- |
| **You** | Commit the CI file once; then start each day with `status` |
| **Your agent** | Follows the same loop — `AGENTS.md` tells it how |
| **CI** | Runs `specgate check` on every pull request |

## 1. Put the gate in CI

```bash
specgate ci init --provider github
```

<!-- specgate:out-scratch-ci:begin — generated; edit the source, not this block -->
```text
$ specgate ci init --provider github
    + .github/workflows/spec-gate.yml

  ✔  CI gate installed. On every PR/MR the job:
   1  runs `specgate check` — the specification, then the tests, as locally
     runs your tests: `node --test` (test_cmd)
   2  runs `validate --against-lock` when .specops.lock exists, so a
     moved pack tag or an edited generated file fails the build
   3  publishes `plan --format json` as the spec-plan artifact
  ℹ  Commit the file and open a PR to see the gate in action.
```
<!-- specgate:out-scratch-ci:end -->

`gitlab`, `azure` and `jenkins` work the same way. Commit the file; from the
next pull request, a requirement marked done with a red test fails the build.

## 2. The daily loop

```
specgate status  →  specgate new  →  a test that names the REQ  →  specgate done  →  specgate check
```

**A new requirement** that came up in a conversation, not in a brief:

```bash
specgate new "A member sees which courts are free on a day"
```

<!-- specgate:out-scratch-new:begin — generated; edit the source, not this block -->
```text
$ specgate new "A member sees which courts are free on a day"
  ◆ specgate · new   REQ-005

  ✔  REQ-005 A member sees which courts are free on a day · Draft

    ~ spec.md                        ## REQ-005 — rewrite the obligation
    + features/a-member-sees-which-courts-are.feature   @SCN-006 — fill in the <placeholders>
    ~ docs/specs/traceability.md     row linked to the scenario

  Next ───────────────────────────────────────────────────
  ➜  specgate check
     after you write a test that mentions REQ-005 — that is the link
```
<!-- specgate:out-scratch-new:end -->

Rewrite its sentence in `spec.md` and the `<placeholders>` in its scenario;
while it is `Draft` the gate leaves them alone, and `done` refuses any left.

**Start the day with `status`** — it names the one command to run next:

```bash
specgate status
```

<!-- specgate:out-scratch-status-daily:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   court-bookings

  Requirements  ████░░░░░░░░░░░░░░░░  1 of 5 done

  To do ──────────────────────────────────────────────────
    ○ REQ-001  Preserve existing behaviour                   a test and code
    ○ REQ-005  A member sees which courts are free on a day  a test and code
    ○ REQ-003  A court is never booked twice for the same …  a test and code

  Waiting for an answer ──────────────────────────────────
    ○ REQ-004  A member cancels a booking  an answer to Q1
    Questions: Q1 (docs/specs/changes/archive/2026-01-01-draft-bookings/questions.md)

  Brief         ████████████████████  1 of 1 module(s) drafted   docs/brief.md

  Next ───────────────────────────────────────────────────
  ➜  specgate done REQ-005
     once a test mentions REQ-005 — that mention is the link; done checks first
```
<!-- specgate:out-scratch-status-daily:end -->

**A whole new module** goes back through phase 2: a change, a draft,
`specgate draft <module>`, archive. **A requirement that changes** goes through a change
too, as `MODIFIED`, so the review sees the before and after.

## 3. When the client answers

Write the answer into the change's `questions.md`, update the requirement and
its scenario with the real value, remove `status="Needs Clarification"` from
its `specgate:trace`, and it rejoins the queue: `status` lists it, the harness
builds it, `done` closes it.

## You're done when…

- `.github/workflows/spec-gate.yml` (or your provider's file) is committed.
- Your team starts with `specgate status` and ends with `specgate check`.

## Where to go next

- [Write good requirements and scenarios](../writing-specs.md)
- [Your team's first pull request — author and reviewer](../first-pr.md)
- [Hand the loop to an agent — the harness](../harness.md)
- [Install a proven pack instead of drafting a module](../domain-packs.md)
- [Every command](../commands.md)

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `.github/workflows/spec-gate.yml already exists — refusing to overwrite.` | You already have that file | `--stdout` to print the job and paste it in, or `--force` to replace |
| `Unknown provider: circleci` | Not supported | `github`, `gitlab`, `azure` or `jenkins`; or run `specgate check` from any CI by hand |
| `status` says `Next  specgate plan` | A requirement has no feature file | `specgate plan` names it |

[← Back to the start](../getting-started.md)

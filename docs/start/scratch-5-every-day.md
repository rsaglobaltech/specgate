# From scratch · 5 — Every day

<!-- specgate:goal -->
**When you finish:** the gate on every pull request, and a daily loop short enough to
remember — five commands, none of which asks you to edit a matrix.
<!-- specgate:endgoal -->

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
  ◆ specgate · ci init   github

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
specgate status  →  specgate propose  →  a test that names the REQ  →  specgate apply  →  specgate check  →  specgate archive
```

<!-- specgate:tip -->
**Lost? Type `specgate` on its own.** Inside a project it shows `status`:
where everything stands, and the one command to run next. Every command
ends the same way — a **Next** block with the command alone on its line, so
you can copy it.
<!-- specgate:endtip -->

**A new requirement** that came up in a conversation, not in a brief:

```bash
specgate new "A member sees which courts are free on a day"
```

<!-- specgate:out-scratch-new:begin — generated; edit the source, not this block -->
```text
$ specgate new "A member sees which courts are free on a day"
  ◆ specgate · new   REQ-012

  ✔  REQ-012 A member sees which courts are free on a day · Draft

    ~ spec.md                        ## REQ-012 — rewrite the obligation
    + features/a-member-sees-which-courts-are.feature   @SCN-002 — fill in the <placeholders>
    ~ docs/specs/traceability.md     row linked to the scenario

  Next ───────────────────────────────────────────────────
  ➜  specgate check
     after you write a test that mentions REQ-012 — that is the link
```
<!-- specgate:out-scratch-new:end -->

Rewrite its sentence in `spec.md` and the `<placeholders>` in its scenario;
while it is `Draft` the gate leaves them alone, and `apply` refuses any left.

**Start the day with `status`** — it names the one command to run next:

```bash
specgate status
```

<!-- specgate:out-scratch-status-daily:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   court-bookings

  Requirements  ████░░░░░░░░░░░░░░░░  1 of 5 done

  Ready to close ─────────────────────────────────────────
    ● REQ-012  A member sees which courts are free on a day  its test is in place

  To do ──────────────────────────────────────────────────
    ○ REQ-001  Preserve existing behaviour                   a test and code
    ○ REQ-003  A court is never booked twice for the same …  a test and code

  Waiting for an answer ──────────────────────────────────
    ○ REQ-004  A member cancels a booking  an answer to Q1
    Questions: Q1 (docs/specs/changes/draft-bookings/questions.md)

  Brief         ░░░░░░░░░░░░░░░░░░░░  0 of 1 module(s) drafted   next: bookings   docs/brief.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply REQ-012
     its test exists; close it through the gate
```
<!-- specgate:out-scratch-status-daily:end -->

**A whole new module** goes back through phase 2: a change, a draft,
`specgate propose --from-brief <module>`, then apply, then archive. **A requirement that changes** goes through a change
too, as `MODIFIED`, so the review sees the before and after.

## 3. When the client answers

Write the answer into the change's `questions.md`, update the requirement and
its scenario with the real value, remove `status="Needs Clarification"` from
its `specgate:trace`, and it rejoins the queue: `status` lists it, the harness
builds it, `apply` closes it.

## Gato, the cat that keeps the gate

At the foot of `status`, on your terminal, sits Gato. You don't feed it by hand:
its state is the project's.

| Gato | Comes from | You look after it with |
| --- | --- | --- |
| Grows: egg, kitten, cat, crowned legend | the share of requirements closed | `specgate apply` |
| Healthy, or sick | how the last `specgate check` ended | a green gate |
| Worried | requirements waiting for an answer | answering `questions.md` |
| Asleep | no `check` for a week | running `check` |
| 🔥 streak | days in a row the gate ended green | keeping it green |

Whatever it says ends with the same command `status` gives you. `specgate pet`
shows the whole cat and its four needs. It never appears in a pipe, a log or
CI, and `specgate config set pet off` puts it away. The streak lives in
`.specgate/pet.json`, which git ignores: the cat is yours, not the team's.

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

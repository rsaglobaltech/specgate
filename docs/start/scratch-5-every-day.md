# From scratch · 5 — Every day

> **The short version** of a new project, in six commands: [Start](../start.md). This page is the same step in detail, with recorded output.

<!-- specgate:goal -->
**When you finish:** the gate on every pull request, and a daily loop short
enough to remember — four verbs: `propose`, `apply`, `status` and `archive`.
<!-- specgate:endgoal -->

**Before you start:** phases [1](scratch-1-install.md) to
[4](scratch-4-prove.md) are done, and the project is on a Git host with CI
(GitHub, GitLab, Azure DevOps or Jenkins).

| Who | Does what in this phase |
| --- | --- |
| **You** | Commit the CI file `init` wrote; then start each day with `status` |
| **Your agent** | Follows the same loop — `AGENTS.md` tells it how |
| **CI** | Runs `specgate check` on every pull request |

## 1. The gate is already in CI

`specgate init` wrote it: `.github/workflows/spec-gate.yml` — or the file for
GitLab, Azure DevOps or Jenkins when the folder shows one. It runs
`specgate check` on Ubuntu, macOS and Windows, compares the requirement ids
with the base branch, runs the quality checks once you configure them, checks
the packs and keeps the plan. A step whose tool is not configured yet says so
and passes. See what it checks:

```bash
specgate ci status
```

<!-- specgate:out-scratch-ci:begin — generated; edit the source, not this block -->
```text
$ specgate ci status
  ◆ specgate · ci status   .github/workflows/spec-gate.yml

  ✔  the specification (validate --strict)
  ✔  the project's tests (check runs test_cmd)
  ✔  the architecture check (check runs arch_cmd)
  ✔  Ubuntu, macOS and Windows
  ✔  the requirement ids against the base branch (check --base)
  ✔  the quality checks (quality run)
  ✔  the pack drift (validate --against-lock)
  ✔  the pending-work plan (plan --format json)

  ✔  Everything specgate can check runs in CI.
```
<!-- specgate:out-scratch-ci:end -->

It checks more than less on purpose: every step says in the YAML what it
checks and what to delete to remove it. One step only:
`specgate ci init --provider github --minimal --force`. Another provider:
`specgate ci init --provider gitlab`. Commit the file, and make the job a
required check in your main branch's protection rules: from then on, a pull
request with a red test cannot merge.

## 2. Where work comes from

Work arrives in one of three ways. Each opens a **change** — a folder with
the requirements and scenarios being added — and from there the loop is the
same.

| The work arrives as… | Open the change with | Guide |
| --- | --- | --- |
| One behaviour, or a feature with a few rules | `specgate propose <change-id>` | This page, below |
| A Jira story with acceptance criteria | `specgate propose --from-ticket <KEY>` | [From a Jira ticket](../from-a-ticket.md) |
| A new module of the product, from the brief | `specgate propose --from-brief <module>` | [Phase 2](scratch-2-specify.md) |

A Jira ticket is read, never written to.
`specgate propose --from-ticket KAN-13 --check` runs its Definition of Ready
(rules T1–T9: acceptance criteria present, measurable, small enough), and the
same command without `--check` opens the change and pushes its branch,
`feature/KAN-13-<slug>`.

## 3. The daily loop

1. **Propose** — open the change and write its delta: the requirements and
   scenarios it adds.
2. **Build** — for each requirement, a test that names it, then the code.
3. **Apply** — `specgate apply REQ-NNN`; commit.
4. **Archive** — `specgate archive <change-id>` once every requirement is
   applied, on your branch.
5. **Pull request** — the specification and the code reach review together.
   For a ticket's change, the `alm pr` command opens it — see
   [From a Jira ticket](../from-a-ticket.md).

```
specgate propose  →  test and code  →  specgate apply  →  specgate archive  →  pull request
```

<!-- specgate:tip -->
**Lost? Type `specgate` on its own.** Inside a project it shows `status`:
where everything stands, and the one command to run next. Every command
ends the same way — a **Next** block with the command alone on its line, so
you can copy it.
<!-- specgate:endtip -->

**A new requirement** that came up in a conversation, not in the brief:

```bash
specgate propose free-courts
```

<!-- specgate:out-scratch-propose:begin — generated; edit the source, not this block -->
```text
$ specgate propose free-courts
  ◆ specgate · propose   free-courts

  ✔  Change free-courts created · lite · REQ ids REQ-012…REQ-014 reserved

    + docs/specs/changes/free-courts/change.yaml
    + docs/specs/changes/free-courts/proposal.md
    + docs/specs/changes/free-courts/tasks.md
    + docs/specs/changes/free-courts/specs/free-courts/spec.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply
     after you write the delta, a test that names each requirement, and the code
```
<!-- specgate:out-scratch-propose:end -->

Replace the template in the change's delta,
`docs/specs/changes/free-courts/specs/free-courts/spec.md`, with the
requirement and its scenario:

```markdown
### Requirement: REQ-012 — A member sees which courts are free on a day

<!-- specgate:trace actor=Member kind=functional -->

The system SHALL list, for a day, the courts that are free at each hour.

#### Scenario: SCN-006 — The centre court is taken on Monday evening

- GIVEN the centre court is booked on Monday evening
- WHEN a member sends GET /api/courts/free?day=monday
- THEN Monday evening lists every court except the centre court
```

**Start the day with `status`** — it lists the new requirement with the rest,
and names the one command to run next:

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
    ○ REQ-003  A court is never booked twice for the same …  a test and code
    ○ REQ-012  A member sees which courts are free on a day  a test and code

  Waiting for an answer ──────────────────────────────────
    ○ REQ-004  A member cancels a booking  an answer to Q1
    Questions: Q1 (docs/specs/changes/draft-bookings/questions.md)

  ·  No agent set for the harness and the studio's Build: specgate config set agent "claude -p < {prompt_file}"

  Brief         ████████████████████  1 of 1 module(s) drafted   docs/brief.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply REQ-003
     once a test mentions REQ-003 — that mention is the link; apply checks first
```
<!-- specgate:out-scratch-status-daily:end -->

**A requirement that changes** goes through a change too, under
`## MODIFIED Requirements` in its delta, so the review sees the before and
after.

## 4. When the client answers

Write the answer into the change's `questions.md`, update the requirement and
its scenario with the real value, remove `status="Needs Clarification"` from
its `specgate:trace`, and it rejoins the queue: `status` lists it, the harness
builds it, `apply` marks it done.

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

- `.github/workflows/spec-gate.yml` (or your provider's file) is committed, and
  the job is a required check.
- Your team starts with `specgate status` and ends each change with
  `specgate archive` and a pull request.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `.github/workflows/spec-gate.yml already exists — refusing to overwrite.` | You already have that file | `--stdout` to print the job and paste it in, or `--force` to replace |
| `Unknown provider: circleci` | Not supported | `github`, `gitlab`, `azure` or `jenkins`; or run `specgate check` from any CI by hand |
| `status` says `Next  specgate plan` | A requirement has no feature file | `specgate plan` names it |

## Next

- [From a Jira ticket](../from-a-ticket.md)
- [Write good requirements and scenarios](../writing-specs.md)
- [Your team's first pull request — author and reviewer](../first-pr.md)
- [Hand the loop to an agent — the harness](../harness.md)
- [Every command](../commands.md)

[← Back to the start](../getting-started.md)

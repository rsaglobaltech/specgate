# Specgate or OpenSpec

[OpenSpec](https://github.com/Fission-AI/OpenSpec) made specification-driven
work with coding agents popular, and it deserves to be the first tool you look
at. Specgate exists for one reason OpenSpec leaves to you on purpose: **proving
that what an agent calls done is done.**

<!-- specgate:note -->
Checked against OpenSpec v1.14.1 (October 2026), its documentation and its
source. If something here is out of date, open an issue and we will fix it.
<!-- specgate:endnote -->

## The short answer

Both tools now share the daily verbs: `propose`, `apply`, `archive`. The
difference is what stands behind `apply` and `archive`.

- **Choose OpenSpec** if you want that light change loop with the widest agent
  support, and you will enforce tests yourself.
- **Choose Specgate** if "done" has to mean a test names the requirement and
  your suite passes, if specifications come from a client's brief, or if an
  agent builds unattended. Its loop is the same four words — `propose`,
  `apply`, `status`, `archive` — with the gate inside `apply` and `archive`
  ([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).
- **Use both** if your team already writes OpenSpec: keep it, and let
  [`specgate verify`](openspec.md) gate what it archives. Nothing to migrate.

## Where they differ

| | Specgate | OpenSpec |
| --- | --- | --- |
| **The daily loop** | `specgate propose`, `apply`, `status`, `archive`; `init` once and `check` in CI. | `/opsx:propose`, `/opsx:apply`, `/opsx:archive`. |
| **What "done" means** | `specgate apply` refuses a requirement no test names, and marks it Implemented only if the gate — specification, matrix, your test suite — passes. | `/opsx:apply` works through the task list; ticking a task is the record. |
| **When a change is archived** | When its code is done: `specgate archive` refuses while a requirement it adds or modifies is not Implemented, and `--force` does not skip that. | Archive asks to continue when tasks are unchecked, and `--yes` skips the question. `/opsx:verify` is an AI review, and its docs say it "won't block archive". |
| **Your tests** | Run by the gate. A test that mentions `REQ-007` is linked to it; nothing to maintain by hand. | Not run or linked by the CLI. The docs suggest enforcing it "with your own CI or hook". |
| **A draft written from a brief** | `specgate propose --from-brief <module>` hands your agent the brief and the formats, then compares the draft with the brief and stops on numbers, limits and fees the brief never stated. | Prompts ask the agent not to invent intent and to record its assumptions; nothing checks the result. |
| **Open questions** | A requirement in *Needs Clarification* cannot be built by the harness or delivered by `apply` until someone answers. | Recorded as assumptions in prose; nothing blocks on them. |
| **Unattended building** | `specgate harness run`: one requirement per git worktree, the gate after each attempt, failures fed into the next. It merges only with `--chain`, one green requirement at a time. | `/opsx:apply` works through the task list in your agent session. |
| **Proof for the business** | `specgate report`: one page per product — what is done, what is pending, what is missing a test. | `openspec view`, a terminal dashboard. |
| **Scenarios** | Gherkin, tagged `@REQ-NNN @SCN-NNN`, executable by a real runner. | Markdown `#### Scenario:` with WHEN/THEN bullets. |
| **Existing code** | `init` adopts a repository without touching code and proposes capabilities from its build files. | Brownfield-first: specs grow change by change. |

## Where OpenSpec is ahead

We would rather you hear it from us:

- **Adoption.** Tens of thousands of stars, hundreds of thousands of weekly
  downloads and an active community. Specgate is young and small.
- **Agent support.** Integrations for 30+ agent tools, against Specgate's 10.
- **Weight.** No tests, no particular language and no CI are required to start.
  Specgate's verbs are as few, but `apply` asks for a test per requirement and
  `archive` waits for all of them — that is the point, and it is also more
  work.
- **Customisation.** OpenSpec's workflow schemas can be forked and shared;
  Specgate's lifecycle is fixed.

## What we learned building six products

Every difference above comes from something that went wrong on a
[pilot](projects/index.md):

- **All 47 requirements done, product unusable** — no routes, no screens. The
  checklist now asks for an API scenario and a screen scenario per actor
  ([Rebar Crew](projects/rebar-crew.md)).
- **Every test green, nobody could buy** — the cart had no button. A scenario
  that only exercises the API is built as an API
  ([Credit shop](projects/credit-shop.md)).
- **The app did not start with the gate green** — a startup test with no
  doubles now runs in the suite ([FinCore](projects/fincore.md)).
- **A drug-interaction rule nobody gave us** stayed out of the code because
  *Needs Clarification* blocked it ([HealthTech](projects/healthtech.md)).

A change log that says "done" would not have caught any of them. A gate that
runs the product's tests caught most of them, and running the product caught
the rest.

## Moving over, or not

| You have | Do this |
| --- | --- |
| OpenSpec, and you are happy with it | Add [`specgate verify`](openspec.md) to CI. It reads `openspec/` and never writes to it. |
| OpenSpec, and you want the full loop | Start a [Specgate journey on an existing project](getting-started.md). Keep `openspec/` as history. |
| Neither | Start from [Getting started](getting-started.md). |

The [full comparison](comparisons.md) also covers Spec Kit, Cursor rules and a
plain README.

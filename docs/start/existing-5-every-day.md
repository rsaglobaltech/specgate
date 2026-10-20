# Existing project · 5 — Every day

<!-- specgate:goal -->
**When you finish:** a daily loop in which the specification grows with the
work you were doing anyway — one change per bug fix, story or module —
instead of as a project of its own.
<!-- specgate:endgoal -->

**Before you start:** phases [1](existing-1-adopt.md) to
[4](existing-4-ci.md) are done — the gate runs on every pull request.

| Who | Does what |
| --- | --- |
| **You** | Start with `status`; open a change whenever work arrives |
| **Your agent** | Follows the same loop — `AGENTS.md` tells it how |
| **CI** | Holds every applied requirement on every pull request |

## Start the day with `status`

```bash
specgate status
```

<!-- specgate:out-existing-status-daily:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   invoicing

  Requirements  █████░░░░░░░░░░░░░░░  1 of 4 done

  To do ──────────────────────────────────────────────────
    ○ REQ-001  Preserve existing behaviour  a test and code
    ○ REQ-002  Invoices                     its scenario
    ○ REQ-003  Customers                    its scenario

  Next ───────────────────────────────────────────────────
  ➜  specgate plan
     REQ-002's feature file is missing — plan shows which
```
<!-- specgate:out-existing-status-daily:end -->

`specgate` on its own does the same. Every command ends with a **Next** block:
the one command to run next, alone on its line so you can copy it. On your
terminal, `status` also shows **Gato**, the cat that keeps the gate: it grows
as requirements are applied and falls sick when `check` is red —
[what it means](scratch-5-every-day.md#gato-the-cat-that-keeps-the-gate).
`specgate config set pet off` puts it away.

## Where work comes from

Work arrives in one of three ways. Each opens a change, and from there the
loop is the same.

| The work arrives as… | Open the change with | Guide |
| --- | --- | --- |
| A bug fix, a small feature, a rule you touch | `specgate propose <change-id>` | [Phase 2](existing-2-specify.md) |
| A Jira story with acceptance criteria | `specgate propose --from-ticket <KEY>` | [From a Jira ticket](../from-a-ticket.md) |
| A new product area, described in a plan | `specgate propose --from-brief <module>` | [Write the brief](write-the-brief.md) |

**A change you describe** is the common case: you, or your agent, write its
delta.

**A Jira ticket** is read, never written to. Run the ticket check first:

```bash
specgate propose --from-ticket KAN-13 --check
specgate propose --from-ticket KAN-13
```

`--check` runs the ticket's Definition of Ready — rules T1 to T9, such as
"every acceptance criterion can be measured". The second command opens the
change from the story, with its text in `ticket.md`, and creates and pushes
the branch `feature/KAN-13-<slug>`. [From a Jira ticket](../from-a-ticket.md)
covers the one-time setup.

**A brief** — `docs/brief.md` — is for a large area: it is drafted one module
at a time, each module its own change.

## The loop

1. **Propose.** Open the change, from one of the three sources above, and
   write or review its delta.
2. **Build.** For each requirement, write the test first and name the
   requirement in it (`REQ-007`), then the code — by hand, with your agent,
   or with [the harness](../harness.md).
3. **Apply.** `specgate apply REQ-007` runs the gate and marks the
   requirement `Implemented`. Commit; for ticket work, start the commit
   message with the ticket key.
4. **Archive.** Once every requirement of the change is applied,
   `specgate archive <change-id>` merges it into the specification — on your
   branch.
5. **Pull request.** The specification and the code reach review together,
   and CI runs the gate. For a ticket's change, the `alm pr` command opens its
   one pull request on GitHub — see [From a Jira ticket](../from-a-ticket.md).

```
specgate propose  →  test and code  →  specgate apply  →  specgate archive  →  pull request
```

## Three habits that make adoption stick

1. **Every bug fix gets a requirement.** Before fixing it, open a change for
   the behaviour that broke, write the scenario that reproduces it, and name
   it in the test. The fix applies it. Your specification fills up where the
   risk actually was.
2. **One module at a time.** When a module matters — billing, permissions,
   anything regulated — describe it as a change, as in
   [phase 2](existing-2-specify.md#the-whole-module-when-you-are-ready). Then
   replace or remove the requirement adoption proposed for it.
3. **New features start as requirements.** A feature request becomes a
   change, a ticket's change or a brief's module before it becomes code.

## Let the agent take requirements off the list

Once a requirement has a real scenario, the harness — Specgate's runner for
unattended work — can build it: one git worktree per requirement, your agent
writing the code, your gate as the judge. It is useful for the backlog of
small, well-specified behaviours. See [the harness](../harness.md).

## Next

- [From a Jira ticket](../from-a-ticket.md)
- [Write good requirements and scenarios](../writing-specs.md)
- [Your team's first pull request — author and reviewer](../first-pr.md)
- [Every command](../commands.md)

[← Back to the start](../getting-started.md)

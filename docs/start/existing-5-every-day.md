# Existing project · 5 — Every day

<!-- specgate:goal -->
**When you finish:** the specification grows with the work you were doing anyway — one
behaviour per bug fix, one module per quarter — instead of as a project of
its own.
<!-- specgate:endgoal -->

| Who | Does what |
| --- | --- |
| **You** | Start with `status`; write down a behaviour whenever you touch it |
| **Your agent** | Follows the same loop — `AGENTS.md` tells it how |
| **CI** | Holds every closed requirement on every pull request |

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

`specgate` on its own does the same. On your terminal, `status` ends with
**Gato**, the cat that keeps the gate: it grows as requirements close, falls
sick when `check` is red, and repeats the next command —
[what it means](scratch-5-every-day.md#gato-the-cat-that-keeps-the-gate).
`specgate config set pet off` puts it away.

## The loop

```
specgate status  →  specgate new  →  a test that names the REQ  →  specgate done  →  specgate check
```

## Three habits that make adoption stick

1. **Every bug fix gets a requirement.** Before fixing it, `specgate new`
   the behaviour that was broken, write the scenario that reproduces it, name
   it in the test. The fix closes it. Your specification fills up where the
   risk actually was.
2. **One module at a time, as a change.** When a module matters — billing,
   permissions, anything regulated — describe it with `change new`, let your
   agent draft it from the code, run `draft --check`, review, archive. Then
   replace or remove its proposed requirement from adoption.
3. **New features start as requirements.** A feature request becomes
   `specgate new` (or a change with a brief), before the code — the same path
   as [a new project](scratch-2-specify.md).

## Let the agent take requirements off the list

Once a requirement is written down with a real scenario, the harness can build
it unattended, on its own branch, with your gate as the judge — useful for the
backlog of small, well-specified behaviours. See [the harness](../harness.md).

## Where to go next

- [Write good requirements and scenarios](../writing-specs.md)
- [Brownfield adoption, worked end to end](../case-studies/case-1.md)
- [Your team's first pull request — author and reviewer](../first-pr.md)
- [Every command](../commands.md)

[← Back to the start](../getting-started.md)

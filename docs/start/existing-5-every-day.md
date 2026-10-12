# Existing project · 5 — Every day

**Existing project:** [1 Adopt](existing-1-adopt.md) → [2 Specify](existing-2-specify.md) →
[3 First requirement](existing-3-first-requirement.md) → [4 CI](existing-4-ci.md) →
**5 Every day**

**Goal:** the specification grows with the work you were doing anyway — one
behaviour per bug fix, one module per quarter — instead of as a project of
its own.

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
  📊 Project status  invoicing

  Requirements  4 total · 1 done · 3 pending

  To do
    REQ-001   Preserve existing behaviour                   a test and code
    REQ-002   Invoices                                      its scenario
    REQ-003   Customers                                     its scenario

  Next  specgate plan  — REQ-002's feature file is missing — plan shows which
```
<!-- specgate:out-existing-status-daily:end -->

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

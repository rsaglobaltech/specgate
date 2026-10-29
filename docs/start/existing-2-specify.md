# Existing project · 2 — Write down what you rely on

<!-- specgate:goal -->
**When you finish:** one behaviour the business already depends on, written as a
requirement with a concrete example, in an open change — the first thing the
gate can hold your code to.
<!-- specgate:endgoal -->

**Before you start:** [phase 1](existing-1-adopt.md) is done — Specgate is
adopted and `specgate check` passes.

| Who | Does what in this phase |
| --- | --- |
| **You** | Pick the behaviour; write the requirement and its example |
| **Your agent** | Can write both from the code and the tests — you review |
| **Specgate** | Opens the change and reserves its requirement ids |

## 1. See what adoption proposed

```bash
specgate status
```

<!-- specgate:out-existing-status:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   invoicing

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 3 done

  To do ──────────────────────────────────────────────────
    ○ REQ-001  Preserve existing behaviour  a test and code
    ○ REQ-002  Invoices                     its scenario
    ○ REQ-003  Customers                    its scenario

  ·  No agent set for the harness and the studio's Build: specgate config set agent "claude -p < {prompt_file}"

  Next ───────────────────────────────────────────────────
  ➜  specgate plan
     REQ-002's feature file is missing — plan shows which
```
<!-- specgate:out-existing-status:end -->

`REQ-002 Invoices` and `REQ-003 Customers` are the **capabilities** — areas of
the product — that `onboard` found in your layout. They are placeholders for
whole modules, still `Draft`, and a `Draft` requirement owes nothing yet, so
they do not block the gate. Leave them for now and start smaller.

## 2. Pick one behaviour you would hate to break

Not a module — one rule. The one a customer would call about. Here: *an
invoice total is rounded to the cent*.

## 3. Open a change — `specgate propose`

A **change** is a folder that holds one piece of work until it is built: a
proposal, a task list and a **delta** — the requirements and scenarios the
change adds or modifies. Open one for the rounding rule:

```bash
specgate propose invoice-rounding
```

<!-- specgate:out-existing-propose:begin — generated; edit the source, not this block -->
```text
$ specgate propose invoice-rounding
  ◆ specgate · propose   invoice-rounding

  ✔  Change invoice-rounding created · lite · REQ ids REQ-004…REQ-006 reserved

    + docs/specs/changes/invoice-rounding/change.yaml
    + docs/specs/changes/invoice-rounding/discover.md
    + docs/specs/changes/invoice-rounding/design.md
    + docs/specs/changes/invoice-rounding/tasks.md
    + docs/specs/changes/invoice-rounding/specs/invoice-rounding/spec.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply
     after you write the delta, a test that names each requirement, and the code
```
<!-- specgate:out-existing-propose:end -->

The change reserves a range of requirement ids, so two changes in flight never
pick the same one. Nothing in `spec.md` or `features/` changes yet.

## 4. Write the delta

`propose` wrote a template of `<placeholders>`. Replace it with the real
requirement: one sentence that says what the system SHALL do, and a scenario
with a real example — the numbers your existing test already uses are a good
start. You can write it yourself, or ask your agent to write it from the code
and the test, and review what it wrote.

<!-- specgate:out-existing-delta:begin — generated; edit the source, not this block -->
```text
$ cat docs/specs/changes/invoice-rounding/specs/invoice-rounding/spec.md
# Delta — invoice-rounding

## ADDED Requirements

### Requirement: REQ-004 — An invoice total is rounded to the cent

<!-- specgate:trace kind=business-rule -->

The system SHALL round an invoice total, VAT included, to the cent.

#### Scenario: SCN-002 — Three lines at 21% VAT

- GIVEN an invoice with lines of 3 × 0.10, 1 × 19.99 and 2 × 4.55
- WHEN its total is computed at 21% VAT
- THEN the total is 35.56
```
<!-- specgate:out-existing-delta:end -->

- `REQ-004` is the first id the change reserved; `SCN-002` names the scenario
  (`SCN-001` is the baseline scenario from adoption).
- `kind=business-rule` says what sort of requirement it is: `functional`,
  `non-functional` or `business-rule`.
- A scenario with numbers is a claim someone can check. "Totals are correct"
  is not.

Tick the first tasks in the change's `tasks.md` as you finish them.

## 5. See it in flight

```bash
specgate status
```

<!-- specgate:out-existing-status-change:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   invoicing

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 4 done

  To do ──────────────────────────────────────────────────
    ○ REQ-001  Preserve existing behaviour              a test and code
    ○ REQ-002  Invoices                                 its scenario
    ○ REQ-003  Customers                                its scenario
    ○ REQ-004  An invoice total is rounded to the cent  a test and code

  ·  No agent set for the harness and the studio's Build: specgate config set agent "claude -p < {prompt_file}"

  Next ───────────────────────────────────────────────────
  ➜  specgate plan
     REQ-002's feature file is missing — plan shows which
```
<!-- specgate:out-existing-status-change:end -->

`status`, `check` and `apply` read the requirements of an open change too:
REQ-004 is **in flight** — specified, not yet built or merged into the
specification. It joins the specification when you archive the change, after
it is proved, in the next phase.

## The whole module, when you are ready

To describe all of `src/invoices` rather than one rule at a time, open a
change for the capability and let your agent write its delta from the code
and the tests:

```bash
specgate propose describe-invoices --capability invoices
specgate propose --from-brief --check describe-invoices
```

The second command runs the drafting checklist on the delta: every
requirement has a scenario and a kind, no scenario is left as a template, no
id is used twice. Review it with whoever knows the business, then build and
archive it like any other change, and remove or rewrite the proposed `REQ-002`.

## You're done when…

- `docs/specs/changes/invoice-rounding/` holds REQ-004 with a real sentence,
  not the template.
- Its scenario has a concrete GIVEN/WHEN/THEN and no `<placeholder>`.
- `specgate status` lists REQ-004.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `Next  specgate plan  — REQ-002's feature file is missing` | A proposed capability has no scenario yet | Expected; it is `Draft`. Describe the module later, as above |
| `Change invoice-rounding — delta not written yet, not judged until it is` | The delta is still the template, so REQ-004 is not listed | Write the requirement and its scenario |
| `unfilled placeholder in "given <precondition>"` | A scenario step still has the template's text | Write the real steps |

## Next

**[Phase 3 — close the first requirement →](existing-3-first-requirement.md)**

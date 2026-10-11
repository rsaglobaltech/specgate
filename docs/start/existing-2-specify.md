# Existing project · 2 — Write down what you rely on

**Existing project:** [1 Adopt](existing-1-adopt.md) → **2 Specify** →
[3 First requirement](existing-3-first-requirement.md) → [4 CI](existing-4-ci.md) →
[5 Every day](existing-5-every-day.md) · 10 minutes

**Goal:** one behaviour the business already depends on, written as a real
requirement with a scenario that states a concrete example — the first thing
the gate can actually hold the code to.

| Who | Does what in this phase |
| --- | --- |
| **You** | Pick the behaviour, write the sentence and the example |
| **Your agent** | Can draft both from the code and the tests — you review |
| **Specgate** | Writes the requirement in the three places it lives |

## 1. See what adoption proposed

```bash
specgate status
```

<!-- csda:out-existing-status:begin — generated; edit the source, not this block -->
```text
$ specgate status
  📊 Project status  invoicing

  Requirements  3 total · 0 done · 3 pending

  To do
    REQ-001   Preserve existing behaviour                   a test and code
    REQ-002   Invoices                                      its scenario
    REQ-003   Customers                                     its scenario

  Next  specgate plan  — REQ-002's feature file is missing — plan shows which
```
<!-- csda:out-existing-status:end -->

`REQ-002 Invoices` and `REQ-003 Customers` are the capabilities `onboard`
proposed: placeholders for whole modules, still `Draft`. They owe nothing, so
they do not block the gate. Leave them for now and start smaller.

## 2. Pick one behaviour you would hate to break

Not a module — one rule. The one a customer would call about. Here: *an
invoice total is rounded to the cent*.

```bash
specgate new "An invoice total is rounded to the cent"
```

<!-- csda:out-existing-new:begin — generated; edit the source, not this block -->
```text
$ specgate new "An invoice total is rounded to the cent"
✔  REQ-004 An invoice total is rounded to the cent (Draft)
   spec.md                      ## REQ-004 — rewrite the obligation
   features/an-invoice-total-is-rounded-to.feature @SCN-002 — fill in the <placeholders>
   docs/specs/traceability.md   row linked to the scenario

   Next: write a test that mentions REQ-004 — that is the link — then specgate check
```
<!-- csda:out-existing-new:end -->

## 3. Replace what `new` wrote with the real thing

`new` writes a sentence and a scenario of `<placeholders>`. Rewrite both. In
`spec.md`:

```markdown
## REQ-004 — An invoice total is rounded to the cent

<!-- csda:trace kind=business-rule -->

The system SHALL round an invoice total, VAT included, to the cent.
```

And the scenario, with a real example — the numbers your existing test already
uses are a good start:

<!-- csda:out-existing-feature:begin — generated; edit the source, not this block -->
```text
$ cat features/an-invoice-total-is-rounded-to.feature
Feature: An invoice total is rounded to the cent

  @REQ-004 @SCN-002
  Scenario: Three lines at 21% VAT
    Given an invoice with lines of 3 × 0.10, 1 × 19.99 and 2 × 4.55
    When its total is computed at 21% VAT
    Then the total is 35.56
```
<!-- csda:out-existing-feature:end -->

A scenario with numbers is a claim someone can check. "Totals are correct" is
not.

## The whole module, when you are ready

To describe `src/invoices` completely rather than one rule at a time, do it as
a reviewed change — the same flow as a new project's brief:

```bash
specgate change new describe-invoices --capability invoices
```

Your agent drafts requirements from the code and the tests, `draft --check`
reviews the draft, you read it, and `change archive` merges it. See
[From the brief to a checked spec](scratch-2-specify.md) — it is the same
four steps — and then remove or rewrite the proposed `REQ-002`.

## You're done when…

- `spec.md` has REQ-004 with a real sentence, not "The system MUST satisfy…".
- Its scenario has a concrete Given/When/Then and no `<placeholder>`.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `Next  specgate plan  — REQ-002's feature file is missing` | A proposed capability has no scenario yet | Expected; it is `Draft`. Describe the module later, as above |
| `unfilled placeholder in "given <the state before the action>"` (from `done` or `check`) | The scenario still has the template | Write the real steps |
| `Written by Specgate. Replace this sentence…` still in `spec.md` | The sentence was not rewritten | Replace it with the real obligation before closing |

**[Next: phase 3 — close the first requirement →](existing-3-first-requirement.md)**

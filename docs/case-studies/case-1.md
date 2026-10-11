# Worked example: adopting Specgate on a service that already ships

<!-- csda:note -->
**An illustration, not a customer — but the commands are real.** "Quayside Supplies" and its
`billing-service` are made up for this page. Every command below was run with
Specgate 0.18.0 on that service, and every output is what it printed — trimmed
with `…`, never edited. For products actually built with Specgate, see
[the six pilots](../projects/index.md).
<!-- csda:endnote -->

**The service:** `billing-service` 2.4.1 — orders, invoices and customer credit,
plain Node.js, six tests that pass, a CI job that runs `npm test`. Five rules the
team relies on live only in the code: totals are rounded once, a shipped order
cannot be cancelled, big orders get a capped discount, a paid order can ship, a
customer cannot pass their credit limit.

**The goal:** write those rules down where a test proves them, put a gate on
every pull request, and start new work from a requirement — without stopping
the team or rewriting anything.

| Step | What happens | Commands |
| --- | --- | --- |
| 1 | Look before writing anything | `onboard` |
| 2 | Adopt in place, gate green | `init`, `config set test_cmd`, `check` |
| 3 | First behaviour, proved by the test you have | `new`, `done` |
| 4 | The gate on every pull request | `ci init`, `status` |
| 5 | A whole module, written down from the code | `change new`, `change validate`, `change archive`, `done` |
| 6 | New work starts as a requirement | `new`, `harness prompt`, `report` |

## 1. Look before writing anything

```text
$ specgate onboard
  1. What this is
     stack:  Node.js
     tests:  npm test
     detected from package.json
  …
  3. Capabilities this codebase already implies
     · Invoices             src/invoices  (2 files)
     · Orders               src/orders  (2 files)
     · Customers            src/customers  (1 files)

     A proposal, not a verdict. Merge, split or rename them.
```

`onboard` writes nothing. It reads the build file and the folder layout, and
names what it found and where. (It suggests `specgate adopt` next; `init` does
the same thing and is the command the rest of the docs use.)

## 2. Adopt in place, gate green

```text
$ specgate init
ℹ️ [INFO] Existing code found (package.json) — adopting this repository in place. Nothing in your code is touched.
…
ℹ️ [INFO] write spec.md
ℹ️ [INFO] write features/adoption/baseline.feature
ℹ️ [INFO] write docs/specs/traceability.md
ℹ️ [INFO] write docs/specs/adr/README.md
ℹ️ [INFO] write AGENTS.md
…
ℹ️ [INFO] - Requirements seeded: 3 proposal(s) from the layout — invoices, orders, customers
⚠️ [WARN] This does not certify your code yet — it certifies the skeleton.
```

Five files, none of them code. Run the gate before anything else:

```text
$ specgate check
…
⚠  No test command configured — this checked the specification, not the code.
   This project's test command looks like `npm test`. Configure it once:
     specgate config set test_cmd "npm test"
…
✔  Gate passed — the specification
```

A green gate that says what it did not check. Tell it how to run the tests,
once, and it runs them from then on — locally, in `done`, and in CI:

```text
$ specgate config set test_cmd "npm test"
  ✔  test_cmd = npm test
     harness.config.yaml
     `check` and `done` now run it.
$ specgate check
…
ℹ pass 6
ℹ fail 0
✔  Gate passed — the specification and `npm test`
```

**Argue with the proposals.** `init` seeded `REQ-002 Invoices`, `REQ-003
Orders` and `REQ-004 Customers` in `spec.md`. Each says it is "Proposed, not
specified" — a folder name is not a rule. Quayside deleted all three sections:
the modules get written down properly in step 5. Deleted ids are not reused, so
the next requirement is `REQ-005`.

## 3. First behaviour, proved by the test you already have

Pick something the team relies on and that a test already exercises:

```text
$ specgate new "An invoice total is rounded to the cent"
✔  REQ-005 An invoice total is rounded to the cent (Draft)
   spec.md                      ## REQ-005 — rewrite the obligation
   features/an-invoice-total-is-rounded-to.feature @SCN-002 — fill in the <placeholders>
   docs/specs/traceability.md   row linked to the scenario
```

Rewrite the obligation in `spec.md`, and the scenario with the numbers the code
really produces — the same ones as in `test/total.test.js`:

```gherkin
Feature: An invoice total is rounded to the cent

  @REQ-005 @SCN-002
  Scenario: Three lines at 21% VAT
    Given an invoice with lines of 3 × 0.10, 1 × 19.99 and 2 × 4.55
    When its total is computed at 21% VAT
    Then the total is 35.56
```

Now close it — and watch it refuse:

```text
$ specgate done REQ-005
❌ [ERROR] --strict-tdd violations detected:
  [TDD-1] Test artifact is TBD but status is 'Implemented' (scenario: SCN-002)
…
✖  REQ-005 not marked Implemented: validation failed. [done_validate_failed]
```

Nothing proves it yet. The test exists; it just does not say what it proves.
One word in its title is the whole link:

```js
test("REQ-005: three lines at 21% VAT are rounded to the cent", () => { … });
```

```text
$ specgate done REQ-005
✔  REQ-005 → Implemented (1 row updated)
```

`done` ran the gate and the six tests before writing anything. Nobody edited
`traceability.md`: it is generated from `spec.md`, the scenario tags and the
tests that mention each id.

**The baseline.** `REQ-001 — Existing behaviour is preserved` stays pending
until a test names it. Quayside added a smoke test that loads every module,
titled `REQ-001: the service's modules load`, and closed it the same way.

## 4. The gate on every pull request

```text
$ specgate ci init --provider github
ℹ️ [INFO] write .github/workflows/spec-gate.yml
ℹ️ [INFO] ✅ CI gate installed. On every PR/MR the job:
ℹ️ [INFO]   1. runs `specgate check` — the specification, then the tests, as locally
ℹ️ [INFO]      runs your tests: `npm test` (test_cmd)
…
```

The existing `ci.yml` stays; the gate is a second job. From here a pull request
that breaks a proved rule, or marks something done that no test proves, fails.

## 5. A whole module, written down from the code

One requirement at a time works for a bug fix. For a module, open a change: it
is reviewed as one pull request and archived into the specification in one go.

```text
$ specgate change new describe-orders --capability orders
  ✔ Change describe-orders created (lite · REQ ids REQ-006…REQ-008 reserved)
    + docs/specs/changes/describe-orders/change.yaml
    + docs/specs/changes/describe-orders/proposal.md
    + docs/specs/changes/describe-orders/tasks.md
    + docs/specs/changes/describe-orders/specs/orders/spec.md
```

The delta is read off `src/orders` and its tests — not invented. One of the
three requirements:

```markdown
### Requirement: REQ-007 — Large orders get a capped discount

The system SHALL take 5% off an order of 500.00 or more, never more than 100.00.

#### Scenario: The cap applies

- GIVEN an order with a net of 2400.00
- WHEN its discount is computed
- THEN the discount is 100.00
```

```text
$ specgate change validate describe-orders
  ✔ describe-orders (1 delta(s))
$ specgate change archive describe-orders
  ✔ Archived as 2026-10-11-describe-orders
    specs:        3 added · 0 modified · 0 removed
    traceability: 3 row(s) added · 0 updated · 0 removed
    features:     3 materialised
```

The three tests in `test/orders.test.js` get their ids in their titles, and
one run closes all three:

```text
$ specgate done REQ-006 REQ-007 REQ-008
✔  REQ-006 → Implemented
✔  REQ-007 → Implemented
✔  REQ-008 → Implemented
   3 of 3 closed; the project's tests ran once.
```

## 6. New work starts as a requirement

Finance asks for something new: a customer with an overdue invoice must not
place an order. It goes in as a requirement first — `specgate new`, then the
obligation ("more than 30 days past its due date") and a scenario with real
values. It stays `Draft` until it is built, so the gate exempts it:

```text
$ specgate check
ℹ️ [INFO] - Strict TDD gate: passed (1 row(s) exempt — still Draft, so not checked)
✔  Gate passed — the specification and `npm test`
```

Someone builds it, by hand or with an agent. `harness prompt` shows exactly
what an agent would be handed; `harness run --req REQ-009 --agent "claude -p < {prompt_file}"`
builds it on its own branch and never merges. See [the harness](../harness.md).

```text
$ specgate harness prompt REQ-009
REQ-009 (NEEDS_EVERYTHING) → branch harness/REQ-009
# Implement REQ-009
…
- Scenario ID: SCN-003
- Test artifact (write this first — TDD): TBD
```

And the product owner gets one page:

```text
$ specgate report --out report.html
📊 Wrote report.html — 83.3% implemented (5/6).
$ specgate status
  Requirements  6 total · 5 done · 1 pending
  To do
    REQ-009   A customer with an overdue invoice cannot p…  a test and code
  Next  specgate done REQ-009  — once a test mentions REQ-009 — that mention is the link; done checks first
```

## Every day after that

- **A bug fix** adds the behaviour it fixes: `specgate new`, its scenario, the
  regression test named after it, `specgate done`.
- **A module someone is about to change** is written down first, as a change.
- **New work** starts as a requirement; `status` always names the next command.
- **Nobody back-fills everything.** The customers module (credit limit) is
  still unwritten, and that is fine: the gate protects what is written down
  and says plainly what it does not cover.

## What to watch

| What | Why it matters |
| --- | --- |
| The seeded proposals are guesses from folder names | Delete or rewrite them; do not mark them done. Their text still mentions `req link` — not needed, a test that names the id is the link. |
| `spec.md` → *Context* came out as `Domain: general`, `API style: REST with DTO boundaries` | Defaults, not read from the code. Correct them; agents read this file. |
| A green `check` with no `test_cmd` checked only the specification | It says so. Set `test_cmd` on day one. |
| Draft rows are exempt from the gate | Right for work in progress; wrong if a requirement stays Draft forever. `status` lists them. |
| `REQ-001` (the baseline) never closes on its own | Name it in a smoke test that loads or starts the service. |

## Next

- [Existing project · 1 Adopt](../start/existing-1-adopt.md) — the same path,
  one short page per phase
- [Writing good requirements and scenarios](../writing-specs.md)
- [Put the gate in CI](../validating.md)

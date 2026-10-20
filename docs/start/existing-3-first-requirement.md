# Existing project · 3 — Close the first requirement

<!-- specgate:goal -->
**When you finish:** REQ-004 marked `Implemented` — proved by a test you already had,
now naming it — and its change archived, so the requirement is part of the
specification.
<!-- specgate:endgoal -->

**Before you start:** [phase 2](existing-2-specify.md) is done — the
`invoice-rounding` change is open and its delta holds REQ-004.

| Who | Does what in this phase |
| --- | --- |
| **You** | Name the requirement in its test; archive the change |
| **The gate** | Refuses until a test names the requirement and the suite passes |

## 1. Try to close it — and see why it refuses

```bash
specgate apply REQ-004
```

<!-- specgate:out-existing-apply-refused:begin — generated; edit the source, not this block -->
```text
$ specgate apply REQ-004
  ◆ specgate · apply REQ-004   Implemented

  ✖  REQ-004  REQ-004 has no test that names it yet (TDD-1).  [apply_no_test]
     fix: write a test that names REQ-004 (and its scenario SCN-002), then run specgate apply REQ-004
```
<!-- specgate:out-existing-apply-refused:end -->

The code is there and a test exists, but nothing connects the requirement to
it. Specgate does not guess which test proves what; a test proves a
requirement by naming it.

## 2. Name the requirement in the test you already have

One edit — the id in the test's name (a comment works too):

<!-- specgate:out-existing-test:begin — generated; edit the source, not this block -->
```text
$ cat test/total.test.js
const test = require("node:test");
const assert = require("node:assert");
const { total } = require("../src/invoices/total");

test("REQ-004: three lines at 21% VAT are rounded to the cent", () => {
  const lines = [
    { quantity: 3, unitPrice: 0.1 },
    { quantity: 1, unitPrice: 19.99 },
    { quantity: 2, unitPrice: 4.55 },
  ];
  assert.equal(total(lines, 0.21), 35.56);
});
```
<!-- specgate:out-existing-test:end -->

That mention is the link. The **traceability matrix** — the table that links
each requirement to its scenario, code and test — is generated from the
specification, the scenario tags and the files that mention each id. Nobody
edits it by hand, and there is nothing to register.

## 3. Apply it

```bash
specgate apply REQ-004
```

<!-- specgate:out-existing-apply:begin — generated; edit the source, not this block -->
```text
$ specgate apply REQ-004
  ◆ specgate · apply REQ-004   Implemented

  ✔  Specification   the gate, for REQ-004
  ✔  Tests           node --test

  ✔  REQ-004 → Implemented (1 row updated)

  Next ───────────────────────────────────────────────────
  ➜  specgate archive invoice-rounding
     every requirement of invoice-rounding is delivered
```
<!-- specgate:out-existing-apply:end -->

`apply` ran the gate — `specgate check` — for REQ-004 and your whole suite
before writing `Implemented`. It does not commit; that stays yours. From now
on, if someone breaks the rounding, `specgate check` fails and names the
requirement that broke.

## 4. Archive the change

Every requirement the change adds is applied, so the change can close:

```bash
specgate archive invoice-rounding
```

<!-- specgate:out-existing-archive:begin — generated; edit the source, not this block -->
```text
$ specgate archive invoice-rounding
  ◆ specgate · archive   invoice-rounding

  ✔  Archived as 2026-01-01-invoice-rounding

    Specs         1 added · 0 modified · 0 removed
    Traceability  1 row(s) added · 0 updated · 0 removed
    Features      1 materialised

  Next ───────────────────────────────────────────────────
  ➜  specgate status
     what each requirement still needs
```
<!-- specgate:out-existing-archive:end -->

`archive` merges the delta into the capability's specification under
`docs/specs/capabilities/`, adds REQ-004 to the traceability matrix, writes
its scenario to `features/`, and moves the change folder to
`docs/specs/changes/archive/`. It refuses while any requirement of the change
is not yet applied, and no flag skips that.

Archive on your branch, before the pull request: the specification and the
code then reach review together.

```bash
git add -A && git commit -m "invoice-rounding: REQ-004, an invoice total is rounded to the cent"
```

## The first requirement often finds a bug

Writing the example down is where the surprises are. If the number in your
scenario and the number your code returns disagree, `apply` refuses with
`the project's tests failed`, and you have found out which one is right
before a customer did. In the [pilot projects](../projects/index.md), smoke
tests at this point found an app that did not start with every test green,
and a screen nobody could reach.

## You're done when…

- `specgate apply REQ-004` printed `→ Implemented`.
- `specgate archive invoice-rounding` printed `Archived as …`.
- `specgate status` shows `1 of 4 done`.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `[TDD-1] Test artifact is TBD but status is 'Implemented'` | No file names `REQ-004` | Put the id in the test's name or a comment |
| `not marked Implemented: the project's tests failed. [done_tests_failed]` | The suite is red | Fix the code or the example — decide which is right |
| `once a test names one of its scenarios (SCN-NNN), each scenario needs a test that names it` | You named one scenario, not all | Name the others too, or name only the requirement |
| `has 1 requirement(s) not delivered yet … [archive_requirements_pending]` | A requirement of the change is not applied | Run the `apply` the fix line names, then archive again |

## Next

**[Phase 4 — put the gate in CI →](existing-4-ci.md)**

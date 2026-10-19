# Existing project · 3 — Close the first requirement

<!-- specgate:goal -->
**When you finish:** REQ-004 marked `Implemented` — proved by a test you already had,
now naming it.
<!-- specgate:endgoal -->

| Who | Does what in this phase |
| --- | --- |
| **You** | Name the requirement in its test |
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

That mention is the link. The traceability matrix is regenerated from
`spec.md`, the scenario tags and the files that mention each id; nobody edits
it by hand, and there is nothing to register.

## 3. Close it

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
  ➜  specgate apply REQ-002
     the next requirement
```
<!-- specgate:out-existing-apply:end -->

`apply` ran the gate for REQ-004 and your whole suite before writing
`Implemented`. From now on, if someone breaks the rounding, `specgate check`
fails — and names the requirement that broke.

## The first requirement often finds a bug

Writing the example down is where the surprises are. If the number in your
scenario and the number your code returns disagree, `apply` refuses with
`the project's tests failed`, and you have found out which one is right
before a customer did. In the [pilots](../projects/index.md), smoke tests at
this point found an app that did not start with every test green, and a
screen nobody could reach.

## You're done when…

- `specgate apply REQ-004` printed `→ Implemented`.
- `specgate status` shows `1 done`.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `[TDD-1] Test artifact is TBD but status is 'Implemented'` | No file names `REQ-004` | Put the id in the test's name or a comment |
| `not marked Implemented: the project's tests failed. [done_tests_failed]` | The suite is red | Fix the code or the example — decide which is right |
| `once a test names one of its scenarios (SCN-NNN), each scenario needs a test that names it` | You named one scenario, not all | Name the others too, or name only the requirement |

**[Next: phase 4 — put the gate in CI →](existing-4-ci.md)**

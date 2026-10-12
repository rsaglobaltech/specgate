# From scratch · 4 — Prove it

**From scratch:** [1 Install](scratch-1-install.md) → [2 Specify](scratch-2-specify.md) →
[3 Build](scratch-3-build.md) → **4 Prove** →
[5 Every day](scratch-5-every-day.md) · 2 minutes

**Goal:** REQ-002 marked `Implemented` — which Specgate only does after the
gate has checked it — the whole gate green, and a page that tells anyone
where the product stands.

| Who | Does what in this phase |
| --- | --- |
| **You** | Ask for the requirement to be closed |
| **The gate** | Decides: the specification is complete, a test names the requirement, and your suite passes — or nothing is written |
| **The report** | Turns the matrix into a page a product owner can read |

## 1. Close the requirement — `specgate done`

```bash
specgate done REQ-002
```

<!-- specgate:out-scratch-done:begin — generated; edit the source, not this block -->
```text
$ specgate done REQ-002
  ◆ specgate · done REQ-002   Implemented

  ✔  Specification   the gate, for REQ-002
  ✔  Tests           node --test

  ✔  REQ-002 → Implemented (1 row updated)

  Next ───────────────────────────────────────────────────
  ➜  specgate status
     what is left, and the next requirement
```
<!-- specgate:out-scratch-done:end -->

Before writing `Implemented`, `done` ran the gate for REQ-002 and your test
command. A missing test, a `<placeholder>` left in a scenario or a red suite,
and it refuses — and writes nothing.

## 2. Watch it refuse what is not finished

REQ-004 is waiting for the client's answer about the late-cancellation fee:

```bash
specgate done REQ-004
```

<!-- specgate:out-scratch-done-blocked:begin — generated; edit the source, not this block -->
```text
$ specgate done REQ-004
  ✖  REQ-004  not marked Implemented: REQ-004 is waiting for an answer (Needs Clarification).  [done_needs_clarification]
     fix: Answer the question that blocks it in its change's questions.md, remove `status="Needs Clarification"` from its `specgate:trace`, write its test, then run `done`.
```
<!-- specgate:out-scratch-done-blocked:end -->

That refusal is the point. An agent asked to "finish the bookings module"
cannot close it by inventing the fee; the question stays open until a person
answers it.

## 3. Run the whole gate — what CI will run

```bash
specgate check
```

<!-- specgate:out-scratch-check-green:begin — generated; edit the source, not this block -->
```text
$ specgate check
  ◆ specgate · check   court-bookings

  ✔  Specification   validate --strict
  ✔  Tests           node --test

  ✔  Gate passed — the specification and `node --test`
```
<!-- specgate:out-scratch-check-green:end -->

`check` is `validate --strict` and then your tests. Requirements still in
`Draft` owe nothing and are counted as exempt, so a pass never hides its own
scope.

## 4. Show where it stands — `specgate report`

```bash
specgate report --out report.html
```

<!-- specgate:out-scratch-report:begin — generated; edit the source, not this block -->
```text
$ specgate report --out report.html
📊 Wrote report.html — 25% implemented (1/4).
```
<!-- specgate:out-scratch-report:end -->

One self-contained HTML page: what is done, what is pending, what is missing
a test, and what is waiting for an answer — readable without the repository.
Here is the same report on one of the pilots:

![The specgate report for the HealthTech pilot: 23 of 24 requirements implemented, each with its feature, test and code, and one waiting for an answer.](../assets/img/report-healthtech.webp)

## You're done when…

- `specgate done REQ-002` printed `→ Implemented`.
- `specgate check` ends with `✔  Gate passed`.
- `report.html` opens and shows your requirements.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `[TDD-1] Test artifact is TBD but status is 'Implemented'` | No test names the requirement | Mention `REQ-NNN` in its test — a comment or the test name |
| `unfilled placeholder in "given <the state before the action>"` | A scenario still has the template's `<placeholders>` | Write the real Given/When/Then |
| `not marked Implemented: the project's tests failed. [done_tests_failed]` | Your suite is red | Make it pass, then `done` again |
| `REQ-004 is waiting for an answer (Needs Clarification). [done_needs_clarification]` | An open question blocks it | Get the answer, record it, remove the status, then test and close |

**[Next: phase 5 — every day →](scratch-5-every-day.md)**

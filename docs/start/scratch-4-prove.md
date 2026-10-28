# From scratch · 4 — Prove it

<!-- specgate:goal -->
**When you finish:** REQ-002 marked `Implemented` — which Specgate only does after the
gate has checked it — the whole gate green, and a page that tells anyone
where the product stands.
<!-- specgate:endgoal -->

**Before you start:** [phase 3](scratch-3-build.md) is done — REQ-002 has a
test that names it, and the test passes.

| Who | Does what in this phase |
| --- | --- |
| **You** | Ask for the requirement to be applied |
| **The gate** (`specgate check`) | Decides: the specification is complete, a test names the requirement, and your suite passes — or nothing is written |
| **The report** | Turns the traceability matrix into a page a product owner can read |

## 1. Apply the requirement — `specgate apply`

```bash
specgate apply REQ-002
```

<!-- specgate:out-scratch-apply:begin — generated; edit the source, not this block -->
```text
$ specgate apply REQ-002
  ◆ specgate · apply REQ-002   Implemented

  ✔  Specification   the gate, for REQ-002
  ✔  Tests           node --test

  ✔  REQ-002 → Implemented (1 row updated)

  Next ───────────────────────────────────────────────────
  ➜  specgate apply REQ-003
     the next requirement
```
<!-- specgate:out-scratch-apply:end -->

Before writing `Implemented`, `apply` ran the gate for REQ-002 and your test
command. A missing test, a `<placeholder>` left in a scenario or a red suite,
and it refuses — and writes nothing. It does not commit either; commit the
test, the code and the status together.

## 2. Watch it refuse what is not finished

REQ-004 is waiting for the client's answer about the late-cancellation fee:

```bash
specgate apply REQ-004
```

<!-- specgate:out-scratch-apply-blocked:begin — generated; edit the source, not this block -->
```text
$ specgate apply REQ-004
  ◆ specgate · apply REQ-004   Implemented

  ✖  REQ-004  not marked Implemented: REQ-004 is waiting for an answer (Needs Clarification).  [done_needs_clarification]
     fix: Answer the question that blocks it in its change's questions.md, remove `status="Needs Clarification"` from its `specgate:trace`, write its test, then run `specgate apply`.
```
<!-- specgate:out-scratch-apply-blocked:end -->

That refusal is the point. An agent asked to "finish the bookings module"
cannot close it by inventing the fee; the question stays open until a person
answers it.

And the draft stays open with it. You archive a change when its code is done
— every requirement it adds applied — so the specification and the code
merge together:

```bash
specgate archive draft-bookings
```

<!-- specgate:out-scratch-archive:begin — generated; edit the source, not this block -->
```text
$ specgate archive draft-bookings
  ✖  draft-bookings  Change 'draft-bookings' has 2 requirement(s) not delivered yet: REQ-003, REQ-004.  [archive_requirements_pending]
     fix: specgate apply REQ-003
```
<!-- specgate:out-scratch-archive:end -->

Once the client answers Q1 and REQ-003 and REQ-004 are applied, the same
command merges the draft into the specification, the traceability matrix and
`features/`. Archive on your branch, then open the pull request: the
specification and its code reach review together.

## 3. Run the whole gate — what CI will run

```bash
specgate check
```

<!-- specgate:out-scratch-check-green:begin — generated; edit the source, not this block -->
```text
$ specgate check
  ◆ specgate · check   court-bookings

  ·  Ids            not compared with a base — no base branch (pass --base <branch>)
  ✔  Specification   validate --strict
  ✔  Tests           node --test
  ·  Architecture    not checked — specgate config set arch_cmd "<command>"

  ✔  Gate passed — the specification and `node --test`
```
<!-- specgate:out-scratch-check-green:end -->

`check` is `validate --strict` and then your tests, then the
[quality checks](../quality.md) when `quality init` wrote them. Requirements still in
`Draft` owe nothing and are counted as exempt, so a pass never hides its own
scope.

## 4. Show where it stands — `specgate report`

```bash
specgate report --out report.html
```

<!-- specgate:out-scratch-report:begin — generated; edit the source, not this block -->
```text
$ specgate report --out report.html
  ◆ specgate · report

  ✔  Wrote report.html

  ░░░░░░░░░░░░░░░░░░░░  0 of 1 implemented   0%
```
<!-- specgate:out-scratch-report:end -->

One self-contained HTML page: what is done, what is pending, what is missing
a test, and what is waiting for an answer — readable without the repository.
Here is the same report on one of the pilot projects:

![The specgate report for the HealthTech pilot: 23 of 24 requirements implemented, each with its feature, test and code, and one waiting for an answer.](../assets/img/report-healthtech.webp)

## You're done when…

- `specgate apply REQ-002` printed `→ Implemented`.
- `specgate check` ends with `✔  Gate passed`.
- `report.html` opens and shows your requirements.

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `[TDD-1] Test artifact is TBD but status is 'Implemented'` | No test names the requirement | Mention `REQ-NNN` in its test — a comment or the test name |
| `unfilled placeholder in "given <the state before the action>"` | A scenario still has the template's `<placeholders>` | Write the real Given/When/Then |
| `not marked Implemented: the project's tests failed. [done_tests_failed]` | Your suite is red | Make it pass, then `apply` again |
| `REQ-004 is waiting for an answer (Needs Clarification). [done_needs_clarification]` | An open question blocks it | Get the answer, record it, remove the status, then test and close |

## Next

**[Phase 5 — every day →](scratch-5-every-day.md)**

# From scratch · 3 — Build the first requirement

<!-- specgate:goal -->
**When you finish:** REQ-002 — *a member books a court for one hour* — implemented, with a
test that names it. Two ways: by hand (or with your agent in the chat), or
handed to the harness, which builds it unattended on its own branch.
<!-- specgate:endgoal -->

**Before you start:** [phase 2](scratch-2-specify.md) is done — the
`draft-bookings` change is reviewed and still open.

| Who | Does what in this phase |
| --- | --- |
| **You** or **your agent** | Write the test first, then the code until it passes |
| **The harness** (optional) | Specgate's runner for unattended work: builds pending requirements one by one, each on its own branch, and merges nothing unless you ask |
| **The gate** | Not yet — that is phase 4 |

## Before the first one: make one scenario run

The first requirement also has to wire the project: the build file's test
dependencies, the BDD or test runner pointed at `features/`, and the folder
layout `AGENTS.md` declares. Do that as part of the first requirement, not as
a separate "setup" step — it is done when one scenario of that requirement
runs for real (not skipped, not pending) under your test command. Every
requirement after it only adds code. If you hand the first one to an agent,
say so in the prompt: "also wire the test runner so this scenario executes".

## Option A — by hand, test first

Read the requirement and its scenarios — in the draft's delta,
`docs/specs/changes/draft-bookings/specs/bookings/spec.md` — then write the test. **Name the
requirement in it**: that mention is the whole link between the test and the
requirement. There is no table to edit and nothing to register.

```js
// test/bookings.test.js
const test = require("node:test");
const assert = require("node:assert");
const { book, list } = require("../src/bookings");

test("REQ-002 SCN-002: booking a free court lasts one hour", () => {
  assert.deepEqual(book("ana", "centre", "mon-18"), { status: 201, minutes: 60 });
});

test("REQ-002 SCN-003: a member sees their bookings", () => {
  assert.equal(list("ana").length, 1);
});
```

Run it, watch it fail, write `src/bookings.js` until it passes:

```bash
node --test
```

<!-- specgate:out-scratch-node-test:begin — generated; edit the source, not this block -->
```text
$ node --test
✔ REQ-002 SCN-002: booking a free court lasts one hour (12ms)
✔ REQ-002 SCN-003: a member sees their bookings (12ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1.234
```
<!-- specgate:out-scratch-node-test:end -->

Any language works the same way: `// REQ-002` in a JUnit test, a pytest
docstring, a Go test name. The gate looks for the id, not for a framework.

## Option B — hand it to the harness

The harness takes the next pending requirement, writes a prompt from its
Gherkin, creates a git worktree on `harness/REQ-NNN`, runs your agent there,
and then runs the gate. Green: the requirement is marked done on its branch.
Red: the failures go into the next attempt. Either way it does not merge —
that stays a person's job, unless you ask for `--chain`, which merges each
requirement that passed into the current branch.

See exactly what your agent will be told, before it runs:

```bash
specgate harness prompt REQ-003
```

<!-- specgate:out-scratch-harness-prompt:begin — generated; edit the source, not this block -->
```text
$ specgate harness prompt REQ-003
  ◆ specgate · harness run   dry run · 1 requirement(s) would be processed

  Setup         none

  REQ-003 · NEEDS_EVERYTHING → branch harness/REQ-003 ────

# Implement REQ-003

You are a coding agent working inside a spec-driven project. Implement exactly one requirement — **REQ-003** — following the project's existing conventions. Do not touch unrelated files.
## The requirement

### Requirement: REQ-003 — A court is never booked twice for the same hour

The system SHALL refuse a booking for a court and hour that is already booked.

> Brief: "A court cannot be booked twice for the same hour."

#### Scenario: SCN-004 — The second booking is refused

- GIVEN the centre court is booked on Monday evening
… 87 more lines
```
<!-- specgate:out-scratch-harness-prompt:end -->

Then run it with your agent's command line — `{prompt_file}` is replaced with
the prompt above:

```bash
specgate harness run --req REQ-003 --agent "claude -p < {prompt_file}" --max-attempts 3
```

Requirements waiting for an answer are skipped on purpose: `harness prompt
REQ-004` says `REQ-004 is not a pending requirement — skipped.` The landing page
has [a recording of a full harness run](../index.html#watch), and
[the harness guide](../harness.md) covers agents, retries, concurrency and cost.

## Review and merge

Whether you or the harness wrote it, a person reviews the branch and merges
it. The harness leaves one branch per requirement precisely so that each
review is one requirement.

## You're done when…

- The tests for REQ-002 name it and pass with your test command.
- The code is merged (or committed, working alone).

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `REQ-004 is not a pending requirement — skipped.` | It is waiting for an answer, or already done | `specgate status` says which |
| `No pending requirements. Nothing to do.` | Every requirement is done or waiting for an answer | Open the next module's draft with `specgate propose --from-brief`, or answer the open questions |
| The harness commits `wip(…): FAILED the gate` | Out of attempts | Read the failures in the commit, fix the spec or the prompt, re-run with `--force` |

## Next

**[Phase 4 — prove it →](scratch-4-prove.md)**

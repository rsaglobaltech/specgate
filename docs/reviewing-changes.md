# Reviewing changes

How to modify a spec that already shipped, without the matrix and the
feature files drifting apart. It is the daily loop of four verbs —
`propose`, `apply`, `status`, `archive` — and a change is archived when its
code is done ([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).

---

## Change a requirement that already shipped

**Goal:** modify the spec tree of a live project without the matrix, the specs
and the feature files drifting apart. Recipes 2–3 cover writing requirements on
day one; this is the loop for every day after.

### 1. Open the change

```bash
specgate propose add-dynamic-pricing --capability pricing
```

```
  ✔  Change add-dynamic-pricing created · lite · REQ ids REQ-014…REQ-016 reserved

    + docs/specs/changes/add-dynamic-pricing/change.yaml
    + docs/specs/changes/add-dynamic-pricing/proposal.md
    + docs/specs/changes/add-dynamic-pricing/tasks.md
    + docs/specs/changes/add-dynamic-pricing/specs/pricing/spec.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply
     after you write the delta, a test that names each requirement, and the code
```

The delta file is named after the change unless `--capability` names the
capability it changes. The reserved ID range is written into `change.yaml`, so
two changes in flight never hand out the same `REQ-NNN`. Use `--full` when the
change also needs a `design.md` and contract artefacts. `specgate change new`
is the old name and still works.

### 2. Let the tool tell you what to write next

```bash
specgate change status
```

```
  ◆ specgate · change status   add-dynamic-pricing · spec-driven

    ✔ proposal  proposal.md
    ▶ specs     specs/**/spec.md
    — design    design.md
    ✔ tasks     tasks.md
```

Artefacts are a dependency graph, not a phase gate (ADR-0018): `▶` is what is
ready to write, `—` is not applicable at this rigor level. Nothing blocks you
from writing them out of order.

### 3. Write the delta

Only what moves — never a copy of the whole spec. One file per capability
under `specs/<capability>/spec.md`:

```markdown
# Delta — pricing

## ADDED Requirements

### Requirement: REQ-014 — Dynamic peak pricing

The system SHALL raise the tariff automatically when occupancy crosses a
configured threshold.

#### Scenario: SCN-014 — Peak rate applies above the threshold

- GIVEN occupancy is above 85%
- WHEN a vehicle enters
- THEN the peak tariff is applied

<!-- specgate:trace uc=UC-007 cmd=CMD-011 agg=AGG-Pricing evt=EVT-PriceApplied
     feature=features/pricing/dynamic_pricing.feature -->
```

Three sections are valid: `## ADDED Requirements`, `## MODIFIED Requirements`,
`## REMOVED Requirements`. `MODIFIED` replaces the whole requirement block — it
does not merge scenario by scenario.

Two things the validator is strict about:

- **Steps are plain `- GIVEN` bullets.** `- **GIVEN**` fails with
  `scenario_not_gherkin`, because the keyword has to start the line.
- **The body needs an RFC-2119 keyword** (`SHALL` / `MUST` / `SHOULD` / `MAY`),
  otherwise you get `no_rfc2119_keyword`. A requirement that states no
  obligation is not a requirement.

The `specgate:trace` comment is optional — it is the bridge to the DDD matrix.
Without it the requirement still archives, with `-` in those columns.

While the change is open its requirements already count: `specgate status`
lists REQ-014 under "To do", and `apply`, `check` and `harness run` judge the
project as it will be after archive. Nothing is written into
`docs/specs/capabilities/` yet.

**`depends=` says what a requirement builds on.** One more key in the same
comment, and the only one `plan` and the harness read rather than the matrix:

```markdown
<!-- specgate:trace uc=UC-008 feature=features/pricing/refunds.feature
     depends=REQ-014 -->
```

Several are separated by commas — `depends=REQ-014, REQ-016`. What it changes:

- **`specgate plan` orders the queue** so a requirement never comes before the work
  it needs, and marks one whose dependency is still pending as `⛔ blocked`.
  Blocked work stops appearing under "next steps", because recommending it was
  never useful.
- **`specgate validate` fails** on a cycle (`requirement_cycle`), on a dependency
  that names no requirement in the project (`unknown_dependency`), and on a
  requirement that depends on itself (`self_dependency`). Each says which ids
  are involved and what to delete.

Declaring nothing means no dependencies, so a project that never writes a
`depends=` behaves exactly as it did before.

### 3b. Or have an agent draft it

```bash
specgate change author add-dynamic-pricing --artifact proposal --agent "claude -p < {prompt_file}"
specgate change author add-dynamic-pricing --artifact specs   --agent-profile local-claude
```

`{prompt_file}` is filled in by Specgate: it writes the prompt it built to a
temporary file and puts that file's path in your command, so any agent that
reads a file or standard input works. A draft written from the brief needs none
of this — [`specgate propose --from-brief <module> --agent "claude -p"`](start/write-the-brief.md)
sends the prompt on standard input ([From a client brief](from-a-brief.md)).

This is the `spec-author` role of the multi-agent harness, and it is a separate
loop from `specgate harness run` on purpose. That loop is built around a
requirement — a worktree per REQ, a branch named for it, a gate of
`validate --strict-tdd` plus your tests. A change has no requirement yet;
writing one is the job. So authoring has its own scope and its own gate.

The prompt is not a second description of what an artefact is for: it is
`specgate change instructions` rendered for an agent, so the rules, the reserved
REQ range and the template are the same ones a person is shown.

**The scope is enforced, not requested.** The agent may write inside
`docs/specs/changes/<id>/` and nowhere else. Anything it writes elsewhere is
put back before you see it: a file it created is deleted, a file it modified is
restored from git. An agent asked to *describe* a change, and able to edit the
capability spec it is describing, can make the change unnecessary instead of
proposing it — quietly, in a diff that looks like the work. `specgate archive`
is what moves a delta into a capability spec, after a human has read it and
its requirements passed the gate.

**It refuses to run on a dirty tree**, and that is not ceremony. Enforcing the
scope means reverting what the agent wrote outside it, and on a dirty tree that
cannot be told apart from what you were in the middle of. Commit or stash
first, and the revert can only ever discard the agent's own work.

`--dry-run` prints the prompt and writes nothing, which is the cheap way to see
what an agent would be asked before paying for it.

### 4. Validate

```bash
specgate change validate add-dynamic-pricing
```

```
  ✔ add-dynamic-pricing (1 delta(s))
```

You rarely need to run this by hand: plain `specgate validate` validates every
active change, so a broken delta fails the PR gate on its own. A project with
no `docs/specs/changes/` directory is unaffected.

### 5. Apply each requirement

The review is the pull request of the change: the delta, the tests that name
its requirements and the code, together. Each requirement goes through the
gate on its own:

```bash
specgate apply REQ-014
```

```
  ✖  REQ-014  REQ-014 has no test that names it yet (TDD-1).  [apply_no_test]
     fix: write a test that names REQ-014 (and its scenario SCN-014), then run specgate apply REQ-014
```

Write the test first and name the requirement in it — that mention is the
link — then the code, and run it again:

```
  ✔  Specification   the gate, for REQ-014
  ✔  REQ-014 → Implemented (1 row updated)
```

The gate is the same as `check`'s: `validate --strict` for the requirement,
your architecture check (`arch_cmd`) and your tests (`test_cmd`). Nothing is
written while it fails. The status goes into the change's delta
(`<!-- specgate:trace status=Implemented -->`). Without an id, `apply` takes
the next requirement `status` names. `specgate done` is the old name.

### 6. Archive it

Archive when every requirement the change adds or modifies is Implemented.
Before that it refuses — `--force` does not skip this:

```
  ✖  add-dynamic-pricing  Change 'add-dynamic-pricing' has 1 requirement(s) not delivered yet: REQ-014.  [archive_requirements_pending]
     fix: specgate apply REQ-014
```

Preview first:

```bash
specgate archive add-dynamic-pricing --dry-run
```

```
  Archive plan ───────────────────────────────────────────
    ~ docs/specs/capabilities/pricing/spec.md   spec
    ~ features/pricing/REQ-014.feature   feature
    ~ docs/specs/traceability.md   traceability
    → docs/specs/changes/add-dynamic-pricing moves to docs/specs/changes/archive/2026-10-19-add-dynamic-pricing
```

Unchecked tasks in `tasks.md` are a warning (`archive_tasks_incomplete`) once
every requirement has passed the gate; `--force` archives a change that has
none and still has unticked tasks. Then:

```bash
specgate archive add-dynamic-pricing
```

```
  ✔  Archived as 2026-10-19-add-dynamic-pricing

    Specs         1 added · 0 modified · 0 removed
    Traceability  1 row(s) added · 0 updated · 0 removed
    Features      1 materialised
```

The delta is merged into `docs/specs/capabilities/pricing/spec.md`, the
feature file is written, and the matrix row arrives already delivered:

```
| REQ-014 | SCN-014 | `features/pricing/REQ-014.feature` | UC-007 | CMD-011 | AGG-Pricing | EVT-PriceApplied | - | test/pricing.test.js | Implemented |
```

The spec and its code merge in one pull request, after the gate passed. A test
that disproves the spec text is fixed in the same change — not in a second
one. `specgate change archive` is the old name.

### When the change modifies a requirement that already shipped

A `MODIFIED` requirement is pending again while the change is open: `plan`
and `status` list it as needing a test for its new scenarios, and `archive`
waits for it like any other. When it is delivered — `specgate apply`, or the
harness — every scenario must be named by a test (`--delivering` holds that one
requirement to it). Two requirements modified by the same change are delivered
one at a time; neither waits for the other. Archiving then rewrites its feature
file from the delta (`archive_feature_regenerated`).

If the feature file holds scenarios that are not in the delta (written by
hand, or removed by the change), archiving leaves it alone and says which
scenarios it lacks (`archive_feature_stale`).

### It composes with packs

| You want | Command |
| --- | --- |
| Review an upstream pack bump as intent, not as a file diff | `specops diff --as-change --pack-version v0.2.0` |
| Send a local change back upstream to the pack | `specops contribute --change add-dynamic-pricing` |
| Fail CI when the project has drifted from the locked pack | `validate --against-lock` |

See recipe 10 for the version-bump workflow those hook into.

---

## Next

- [The agent surface](agents.md)
- [Pack version bumps as changes](domain-packs.md)

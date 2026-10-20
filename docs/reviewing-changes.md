# Change a shipped requirement

At the end of this page you can add or change requirements in a live project
through a **change**, so the specs, the feature files and the traceability
matrix never drift apart. A change is a folder under
`docs/specs/changes/<id>/` that holds the requirements being added, modified
or removed until they are built.

**You need:** a project where `specgate init` has run, and a test command
configured (`specgate config set test_cmd "npm test"`).

The loop is four commands: `propose` opens the change, `apply` delivers each
requirement, `status` says what is left, and `archive` closes the change once
every requirement in it is delivered
([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)). For writing your
first requirements on a new project, see [Writing specs](writing-specs.md).

## 1. Open the change

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

- **`lite`** is the default level of detail: a proposal, a task list and a
  delta. `--full` also creates a `design.md` for changes that need a written
  design.
- **The delta** is `specs/<capability>/spec.md`: only the requirements this
  change adds, modifies or removes. It is named after the change unless
  `--capability` names the capability it belongs to.
- **The reserved ids** are written into `change.yaml`, so two changes in flight
  never hand out the same `REQ-NNN`. `--reserve <n>` reserves more than three.

## 2. See what is left

```bash
specgate status
```

`status` lists what is still to do, including the requirements of open
changes, and names the one command to run next. Until you write the delta, it
says the change is not judged yet.

To see which file of the change to write next, run
`specgate change status add-dynamic-pricing`. The files of a change form a
dependency graph, not a sequence of phases
([ADR-0018](specs/adr/0018-artifact-schemas.md)): nothing stops you writing
them in another order.

## 3. Write the delta

Write only what changes, never a copy of the whole spec:

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

Three sections are valid: `## ADDED Requirements`, `## MODIFIED Requirements`
and `## REMOVED Requirements`. `MODIFIED` replaces the whole requirement block;
it does not merge scenario by scenario.

The validator is strict about two things:

- **Steps are plain `- GIVEN` bullets.** `- **GIVEN**` fails with
  `scenario_not_gherkin`, because the keyword has to start the line.
- **The body needs an obligation keyword** (`SHALL`, `MUST`, `SHOULD` or
  `MAY`), otherwise you get `no_rfc2119_keyword`.

The `specgate:trace` comment is optional. It fills the use case, command,
aggregate and event columns of the matrix; without it the requirement still
archives, with `-` in those columns.

While the change is open, its requirements already count: `status` lists
REQ-014 as to do, and `apply`, `check` and `harness run` judge the project as
it will be after archive. Nothing is written into `docs/specs/capabilities/`
yet.

**`depends=` says what a requirement builds on.** Add it to the same comment:

```markdown
<!-- specgate:trace uc=UC-008 feature=features/pricing/refunds.feature
     depends=REQ-014 -->
```

Separate several with commas: `depends=REQ-014, REQ-016`. Then:

- **`specgate plan` orders the queue** so a requirement never comes before the
  work it needs, and marks one whose dependency is pending as `⛔ blocked`.
- **`specgate validate` fails** on a cycle (`requirement_cycle`), on a
  dependency that names no requirement (`unknown_dependency`) and on a
  requirement that depends on itself (`self_dependency`).

A project that declares no `depends=` has no dependencies.

## 4. Validate the delta

```bash
specgate change validate add-dynamic-pricing
```

```
  ✔ add-dynamic-pricing (1 delta(s))
```

You rarely need this by hand: `specgate validate` and `specgate check` validate
every open change, so a broken delta fails the gate on its own.

## 5. Apply each requirement

The review is the pull request of the change: the delta, the tests that name
its requirements, and the code, together. Each requirement goes through the
gate on its own:

```bash
specgate apply REQ-014
```

```
  ✖  REQ-014  REQ-014 has no test that names it yet (TDD-1).  [apply_no_test]
     fix: write a test that names REQ-014 (and its scenario SCN-014), then run specgate apply REQ-014
```

Write the test first and name the requirement in it (that mention is the
link), then the code, and run it again:

```
  ✔  Specification   the gate, for REQ-014
  ✔  REQ-014 → Implemented (1 row updated)
```

The gate is the same as `check`'s: `validate --strict` for the requirement,
your architecture check (`arch_cmd`) and your tests (`test_cmd`). Nothing is
written while it fails. The status goes into the change's delta
(`<!-- specgate:trace status=Implemented -->`). Without an id, `apply` takes
the next requirement `status` names. `apply` does not commit: commit after it.

## 6. Archive it

Archive when every requirement the change adds or modifies is Implemented, on
your branch, before you open the pull request. Before that it refuses, and
`--force` does not skip this:

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

Unticked tasks in `tasks.md` are a warning (`archive_tasks_incomplete`);
`--force` archives anyway, once every requirement is delivered. Then:

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

The spec and its code reach review in one pull request, after the gate passed.
A test that disproves the spec text is fixed in the same change, not in a
second one.

### When the change modifies a shipped requirement

A `MODIFIED` requirement is pending again while the change is open: `plan` and
`status` list it as needing a test for its new scenarios, and `archive` waits
for it like any other. When it is delivered, by `apply` or by the harness,
every one of its scenarios must be named by a test. Two requirements modified
by the same change are delivered one at a time; neither waits for the other.
Archiving then rewrites the feature file from the delta
(`archive_feature_regenerated`).

If the feature file holds scenarios that are not in the delta (written by
hand, or removed by the change), archiving leaves it alone and says which
scenarios it lacks (`archive_feature_stale`).

### With domain packs

| You want | Command |
| --- | --- |
| Review an upstream pack upgrade as a change, not a file diff | `specops diff --as-change --pack-version v0.2.0` |
| Send a local change back to the pack | `specops contribute --change add-dynamic-pricing` |
| Fail CI when the project has drifted from the installed pack | `validate --against-lock` |

[Domain packs](domain-packs.md) describes how a pack version upgrade works.

## Have an agent draft a file

`specgate change author` has an agent write one file of a change (the proposal
or the delta), confined to the change folder:

```bash
specgate change author add-dynamic-pricing --artifact proposal --agent "claude -p < {prompt_file}"
specgate change author add-dynamic-pricing --artifact specs --agent-profile local-claude
```

Specgate writes the prompt to a temporary file and puts its path where
`{prompt_file}` stands. The prompt is `specgate change instructions` rendered
for an agent, so the agent gets the same template, rules and reserved ids a
person does. Profiles such as `local-claude` are described in
[Choosing and wiring your agent](agent-setup.md).

- **The scope is enforced.** The agent may write only inside
  `docs/specs/changes/<id>/`. Anything it writes elsewhere is undone before you
  see it, so it cannot edit the capability spec it is meant to propose a change
  to.
- **It refuses to run on a dirty tree.** Undoing the agent's writes must never
  touch your own work, so commit first.
- **`--dry-run`** prints the prompt and writes nothing.

This is separate from `specgate harness run`, which delivers requirements that
already exist, each in its own worktree, against `validate --strict` and your
tests. A change has no requirements until someone writes them. To draft a
change from a brief, see [From a client brief](from-a-brief.md); from a Jira
ticket, see [From a Jira ticket](from-a-ticket.md).

## Next

- [Validating](validating.md)
- [The harness](harness.md)

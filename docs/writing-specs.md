# Writing specs

At the end of this page you can add a requirement with its scenario, link it to
a test, deliver it and remove it, without ever editing the traceability matrix
by hand.

**You need:** a project where `specgate init` has run. Three terms come up
throughout: a **requirement** (`REQ-007`) is one sentence the product must
honour; a **scenario** (`SCN-007`) is a Gherkin example that makes it
executable; the **traceability matrix** (`docs/specs/traceability.md`) is the
table that links each requirement to its scenario, code and test. See
[the vocabulary](concepts.md#vocabulary) for more.

## Add a requirement and its scenario

**Goal:** a new requirement with an executable scenario, linked to a test, with
`check` green, without touching the matrix.

### Through a change

A requirement normally arrives in a **change**: a folder that holds the
requirements being added or modified until they are built.

```bash
specgate propose add-premium-discount
```

This opens `docs/specs/changes/add-premium-discount/` with a proposal, a delta
(the requirements and scenarios the change adds or modifies) and a reserved
range of REQ ids. Write the requirement and its scenario in the delta, then
write a test that names the requirement, then the code. `specgate apply`
delivers it and `specgate archive` merges the change into the specs.
[Change a shipped requirement](reviewing-changes.md) walks through every step
and the delta format.

### The shortcut: `specgate new`

On a small project you can add a requirement straight to `spec.md`, without a
change:

```bash
specgate new "Premium customers get 10% off at checkout"
```

It writes a `## REQ-NNN` section in `spec.md` and a tagged scenario under
`features/`. Rewrite the sentence and fill in the three `<placeholders>`.

By hand, it is the same two edits. The section in `spec.md`:

```markdown
## REQ-007 — Premium customers get 10% off at checkout

A premium customer's order MUST be discounted 10% before tax at checkout.
```

And the scenario in `features/billing/discounts.feature`, tagged with both ids:

```gherkin
Feature: Apply discount on checkout

  @REQ-007 @SCN-007
  Scenario: Premium customer receives 10% discount
    Given a logged-in premium customer
    When they checkout with an order of 100 EUR
    Then the final price is 90 EUR
```

### Link it to a test, and run the gate

Write a test that mentions the requirement: that mention is the link. Then run
the gate:

```bash
specgate check     # regenerates the matrix from spec.md, the tags and the tests
```

Do **not** add a row to `docs/specs/traceability.md`: it is generated, and the
next `check` replaces it with what the sources say. A feature file with no
`@REQ-NNN` tag is reported as an orphan; tag its scenario, or create the
requirement with `specgate new`.

### Writing in Spanish

Scenarios can use `DADO / CUANDO / ENTONCES / Y`; feature files are then written
as Spanish Gherkin (`# language: es`, `Característica`, `Escenario`). To start
from a client's brief instead of a blank page, see
[From a client brief](from-a-brief.md).

## Tagging a scenario

A matrix row names a scenario id. Tags are how the feature file names it back,
and they survive somebody rewording the scenario title:

```gherkin
@REQ-014 @SCN-014
Scenario: A vet with no speciality is listed under "general practice"
  Given a vet with no speciality
  When the directory is listed
  Then the vet appears under "general practice"
```

**Both tags, and `@SCN-NNN` is the one the gate matches.** `@REQ-NNN` says which
requirement the scenario belongs to, and is what a Cucumber `--tags "@REQ-014"`
filter selects; `@SCN-NNN` is what `validate` compares with the row's scenario
id.

**A file with no tags at all is left alone.** Tagging is optional, and tagging
one scenario does not force it on the rest of the project. But once a feature
file carries any of these tags, every row that points into that file must find
its `@SCN-NNN` there.

On a **hand-kept** matrix, a row that declares `SCN-014` and a file tagged
`@REQ-014` alone therefore fails, and says so:

```
✖ features/vets/listing.feature carries traceability tags but not @SCN-014,
  which REQ-014 declares. The matrix points at a scenario that is not there.
```

On a **generated** matrix the row is built from the tags, so a scenario tagged
`@REQ-014` alone still links, with no scenario id in its row. Add `@SCN-NNN`
anyway: a reviewer, a Cucumber filter and a renamed title all rely on it.

## Close the loop: `status` → implement → `apply`

**Goal:** once new requirements are in the project (from a change, or from a
domain pack you installed), work through them one at a time, by hand or with an
agent, without reading every `.feature` file.

```bash
specgate status          # one line per requirement, and the next command
specgate plan            # the same queue, with every artifact spelled out
```

`plan` groups the requirements by what each one still lacks:

```
  Needs Test + Code
    REQ-001   SCN-001
      ✓ feature: `features/audit-log/recording_an_action_emits_auditentryrecorded.feature`
    REQ-002   SCN-002
      ✓ feature: `features/audit-log/tampering_breaks_the_chain_verification.feature`

  Needs Feature File
    REQ-003   -
      · feature: -
```

For an agent, ask for JSON:

```bash
specgate plan --json
```

```json
{
  "schemaVersion": 1,
  "summary": { "NEEDS_EVERYTHING": 2, "NEEDS_FEATURE": 2 },
  "total": 4,
  "actionable": 4,
  "next": "REQ-001",
  "requirements": [
    {
      "requirement": "REQ-001",
      "scenarioId": "SCN-001",
      "category": "NEEDS_EVERYTHING",
      "status": "Draft",
      "ready": true,
      "blockers": []
    }
  ],
  "orphanFeatures": [],
  "status": []
}
```

`next` is the requirement to work on, and `actionable` is how many can be
started now. Each requirement carries its `category`, whether it is `ready`,
and the `blockers` in its way, each with a `code` and a `fix`.

### After implementing, apply it

```bash
specgate apply REQ-007                          # the gate, then Status="Implemented"
specgate apply REQ-007 --status Verified         # Status="Verified", same gate
specgate apply REQ-007 --test-cmd "npm test"     # the gate, then the test suite
specgate apply REQ-007 --no-check                # the status, without the gate
```

`apply` refuses a requirement that no test names, runs the same gate as
`specgate check`, and writes nothing when it fails. The statuses are Draft,
Approved, Implemented, Verified, Released and Deprecated; any other word is
refused. Every one past Draft except Deprecated owes a test (TDD-1), Approved
included: `--status Approved` refuses a requirement no test names, since
`validate --strict` would fail on it. A requirement it closes is
one CI will not reopen. It changes exactly one status, and it does not commit:
commit after it. With `validate --strict` in CI, the matrix stays a true
record of what is delivered.

### With an agent

An agent follows the same loop: `status` or `plan` for the next requirement, a
failing test that names it, the code, then `apply`. To drive it unattended, use
[the harness](harness.md). To give an MCP client (Claude Desktop, Cursor) the
loop as tools, see [The MCP server](mcp.md). There, tools that write the
specification refuse unless a change is open.

## Removing a requirement

```bash
specgate req rm REQ-014 --dry-run   # what would go
specgate req rm REQ-014
```

It removes the requirement's matrix rows and its prose in `spec.md`. Past
Draft it refuses without `--force`: removing a delivered requirement deletes
the record that it shipped, and `specgate apply REQ-014 --status Deprecated` is
usually what you meant.

It reports what it leaves behind, such as a feature file no row references any
more, which would otherwise fail `validate` later.

### There is no `req renumber`

A requirement id appears in more places than the matrix: in `@REQ-014` tags, in
test names, in commit messages, in a `harness/REQ-014` branch somebody already
pushed, and in your issue tracker. Renumbering only the files Specgate owns
would leave every other mention pointing at the old id.

If you need a different id, `req rm` the old one and `req add` the new one, so
the change is visible in the diff.

## A matrix nobody edits

`docs/specs/traceability.md` is **generated**, by default, for every project
`init` or `adopt` creates (`--keep-matrix` opts out). Every column is already
stated somewhere else, so `specgate matrix` computes it:

| Column                    | Comes from                                                             |
| ------------------------- | ---------------------------------------------------------------------- |
| Requirement, Use Case     | the `## REQ-NNN — title` section in `spec.md`                          |
| Scenario ID, Feature file | scenarios tagged `@REQ-NNN @SCN-NNN` (`specgate new` writes them)      |
| Test artifact             | test files that mention `REQ-NNN` — a comment or a test name is enough |
| Technical artifact        | other source files that mention `REQ-NNN`                              |
| Status                    | `status=` in the section's `<!-- specgate:trace … -->` comment         |

What the sources cannot show (a code path, a test that does not name its
requirement, the DDD columns) goes in that same comment:

```markdown
## REQ-003 — Orders can be cancelled

<!-- specgate:trace status=Implemented artifact=lib/orders.js -->
```

**Switching an older project with a hand-kept matrix:**

```bash
specgate matrix --migrate   # writes status and explicit links into spec.md
```

It writes only what the generator would otherwise get wrong, then generates
the matrix and compares it with yours row by row. If anything differs,
**nothing is changed**: it names the requirements it cannot express yet
(usually several rows for one requirement whose scenarios are not tagged) and
how to fix them.

**After that**, the matrix carries a `specgate:derived` marker and is never
edited by hand. `specgate check` regenerates it before the gate; plain
`validate`, which CI runs, fails with `matrix_stale` if a commit forgot to, and
`specgate matrix` fixes that.

The everyday commands write the sources for you: `specgate apply` sets
`status=` in the requirement's comment, `req link` and `req add --feature …`
record their links there, `new`, `req rm` and `archive` regenerate the matrix,
and `status`, `plan` and `check` read it fresh. **One limit:** a domain pack
writes `spec.md` and the matrix from its own templates, so `specgate expand`
turns the project back to a hand-kept matrix and says so; run
`specgate matrix --migrate` once the pack's requirements have `## REQ-NNN`
sections.

## Next

- [Change a shipped requirement](reviewing-changes.md)
- [Validating](validating.md)

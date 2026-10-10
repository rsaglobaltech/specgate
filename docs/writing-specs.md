# Writing specs

Requirements, Gherkin scenarios and the traceability matrix — the three
artefacts everything else is built on.

---

## Add a requirement and its scenario

**Goal:** a new requirement with an executable scenario, linked to a test, with
`check` green — without touching the matrix.

The short way is one command:

```bash
specgate new "Premium customers get 10% off at checkout"
```

It writes the `## REQ-NNN` section in `spec.md` and a tagged scenario under
`features/`. Rewrite the sentence and the three `<placeholders>`.

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

Then a test that mentions the requirement — that mention is the link — and the
gate:

```bash
specgate check     # regenerates the matrix from spec.md, the tags and the tests
```

Do **not** add a row to `docs/specs/traceability.md`: it is generated, and the
next `check` replaces it with what the sources say. A feature file with no
`@REQ-NNN` tag is reported as an orphan; tag its scenario, or create the
requirement with `specgate new`.

---

### Writing in Spanish

Scenarios can use `DADO / CUANDO / ENTONCES / Y`; feature files are then written
as Spanish Gherkin (`# language: es`, `Característica`, `Escenario`). Starting
from a client's brief instead of a blank page: [From a client brief](from-a-brief.md).

## Close the loop: `status` → implement → `done`

**Goal:** after a `specops sync` brings new requirements into the project, drive a human or AI agent through the implementation cycle without manually reading every `.feature` file.

```bash
# 1. After sync (or any time), see what's left
specgate status          # one line per requirement, and the next command
specgate plan            # the same queue with every artifact spelled out
```

`plan` gives the full bucketed report — one bucket per thing still missing:

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

For AI agents, swap to JSON:

```bash
specgate plan --format json
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

`next` is the requirement to work on; `actionable` is how many are left that
can be started now. Each requirement carries its `category`, whether it is
`ready`, and the `blockers` in its way (each with a `code` and a `fix`).

### After implementing, mark the REQ done

```bash
specgate done REQ-007                          # the gate first, then Status="Implemented"
specgate done REQ-007 --status Verified         # → Status="Verified", same gate
specgate done REQ-007 --test-cmd "npm test"     # the gate, then the suite
specgate done REQ-007 --no-check                # writes the status without the gate
```

`done` runs the gate `specgate check` runs and writes nothing when it fails,
so a requirement it closes is one CI will not reopen. It then edits exactly
one status. Combined with `validate --strict` in CI, the matrix is the live source of truth instead of a rear-view mirror.

### AI agent recipe (Claude Desktop / Cursor / Aider with MCP)

The MCP server exposes the daily loop as tools — `specgate_status`,
`specgate_new`, `plan`, `specgate_check`, `mark_requirement_done`
([the MCP server](mcp.md)). A canonical prompt:

```
1. Call `plan` with projectDir set to my repo. Work on the requirement in `next`.
2. Read its scenario (`read_spec`, or the feature file in your editor).
3. Write a test that mentions the requirement id. Run it — confirm it fails.
4. Write production code until the test passes.
5. Call `mark_requirement_done` with `requirement` set to that id. It runs the
   gate first; if it returns done_validate_failed, fix what it reports and retry.
6. Repeat from step 1 until `plan` returns actionable = 0.
7. Call `specgate_check` before you stop.
```

Writing tools are guarded over MCP: they refuse unless a change is open or the
team set `mcpAllowContractEdits` ([why](mcp.md#the-guard-an-agent-may-not-rewrite-its-own-exam)).

---

---

## Next

- [Change something that already shipped](reviewing-changes.md)
- [Enforce it in CI](validating.md)

## Removing a requirement

```bash
specgate req rm REQ-014 --dry-run   # what would go
specgate req rm REQ-014
```

It takes the matrix row (all of them, if the id somehow has more than one) and
the requirement's prose in `spec.md`. Past `Draft` it refuses without `--force`:
removing a delivered requirement deletes the record that it shipped, and
`specgate done REQ-014 --status Deprecated` is usually what you meant.

It reports what it leaves behind — a feature file no row references any more
will fail `validate`, and finding that out from a red build instead of from the
command would waste an afternoon.

### There is no `req renumber`, on purpose

A requirement id is not only a cell in the matrix. It appears in `@REQ-014`
Gherkin tags, in test names, in commit messages, in the `harness/REQ-014` branch
somebody already pushed, and in whatever your issue tracker says. Renumbering
the two files this tool owns while every other mention keeps the old id would
leave the project in a worse state than the one you were fixing.

If you need a different id: `req rm` the old one and `req add` the new, which
makes the change visible in the diff rather than spread across files nobody
looked at.

## Tagging a scenario

A matrix row names a `Scenario ID`. Tags are how the feature file names it back,
and they are what survives somebody rewording the scenario title:

```gherkin
@REQ-014 @SCN-014
Scenario: A vet with no speciality is listed under "general practice"
  Given a vet with no speciality
  When the directory is listed
  Then the vet appears under "general practice"
```

**Both tags, and `@SCN-NNN` is the one the gate matches.** `@REQ-NNN` says which
requirement the scenario belongs to and is what a Cucumber `--tags "@REQ-014"`
filter selects; `@SCN-NNN` is what `validate` compares against the row's
`Scenario ID` column.

**A file with no tags at all is left alone.** Tagging is optional, and adding it
to one scenario does not force it on the rest of the project. But once a feature
file carries any of these tags, every row pointing into that file must find its
`@SCN-NNN` there — a half-tagged file is how a matrix ends up pointing at a
scenario nobody renamed but everybody moved.

On a **hand-kept** matrix, a row that declares `SCN-014` and a file tagged
`@REQ-014` alone therefore fails, and says so:

```
✖ features/vets/listing.feature carries traceability tags but not @SCN-014,
  which REQ-014 declares. The matrix points at a scenario that is not there.
```

On a **generated** matrix the row is built from the tags, so a scenario tagged
`@REQ-014` alone still links — its row shows no scenario id. Add `@SCN-NNN`
anyway: it is what a reviewer, a Cucumber filter and a renamed title all keep.

## A matrix nobody edits

`docs/specs/traceability.md` is **generated** instead of maintained — by
default for every project `init` or `adopt` creates (`--keep-matrix` opts
out). Every column is already said somewhere else, so `specgate matrix`
computes it:

| Column                    | Comes from                                                             |
| ------------------------- | ---------------------------------------------------------------------- |
| Requirement, Use Case     | the `## REQ-NNN — title` section in `spec.md`                          |
| Scenario ID, Feature file | scenarios tagged `@REQ-NNN @SCN-NNN` (`specgate new` writes them)      |
| Test artifact             | test files that mention `REQ-NNN` — a comment or a test name is enough |
| Technical artifact        | other source files that mention `REQ-NNN`                              |
| Status                    | `status=` in the section's `<!-- csda:trace … -->` comment             |

Anything derivation cannot see — a code path, a test that does not name its
requirement, the DDD columns — goes in that same comment, with the grammar
capability specs already use:

```markdown
## REQ-003 — Orders can be cancelled

<!-- csda:trace status=Implemented artifact=lib/orders.js -->
```

**Switching a project created before this:**

```bash
specgate matrix --migrate   # writes status and explicit links into spec.md
```

It writes only what derivation would get wrong, then derives the matrix and
compares it with yours row for row. Any difference and **nothing is changed**:
it names the requirements it cannot express yet — usually several rows for one
requirement whose scenarios are not tagged — and how to fix them.

**After it:** the matrix carries a `specgate:derived` marker and is never edited
by hand. `specgate check` regenerates it before the gate; plain `validate` —
what CI runs — fails with `matrix_stale` if a commit forgot to, and
`specgate matrix` fixes that. A project that has not migrated is untouched by
all of this.

The everyday commands write the sources for you: `specgate done` sets `status=`
in the requirement's comment, `req link` and `req add --feature …` record their
links there, `new`, `req rm` and `change archive` regenerate the matrix, and
`status`, `plan` and `check` read it fresh. `fix` has nothing to repair in a
generated matrix. **One limit, for now:** a domain pack writes `spec.md` and
the matrix from its own templates, so `specgate expand` turns the project back
to a hand-kept matrix and says so; `specgate matrix --migrate` switches it back
once the pack's requirements have `## REQ-NNN` sections.

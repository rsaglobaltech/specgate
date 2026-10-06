# Writing specs

Requirements, Gherkin scenarios and the traceability matrix — the three
artefacts everything else is built on.

---

## Add a Gherkin scenario and keep traceability green

**Goal:** add a feature file and register it in the matrix so `validate` stays green.

```bash
# 1. Create the feature
mkdir -p features/billing
cat > features/billing/discounts.feature <<'EOF'
Feature: Apply discount on checkout
  Scenario: Premium customer receives 10% discount
    Given a logged-in premium customer
    When they checkout with an order of 100 EUR
    Then the final price is 90 EUR
EOF

# 2. Add a row to docs/specs/traceability.md (rich header shown below)
#    | REQ-007 | SCN-007 | features/billing/discounts.feature | UC-007 | ApplyDiscountCommand | CartAggregate | DiscountApplied | DiscountService.java | DiscountServiceTest | Draft |

# 3. Validate
npx @rsaglobaltech/specgate@latest validate .
```

If the new `.feature` is not in `traceability.md`, the validator exits with a non-zero status and tells you the missing file.

---

---

## Close the loop: `plan` → implement → `done`

**Goal:** after a `specops sync` brings new requirements into the project, drive a human or AI agent through the implementation cycle without manually reading every `.feature` file.

```bash
# 1. After sync (or any time), see what's left
specgate plan
```

You get a bucketed report:

```
📋 Plan  (12 requirement(s), 3 pending)

  ❌ Needs everything (no test, no code)
    REQ-007    SCN-007
      · feature: features/pricing/dynamic_pricing.feature
      · test:    src/test/.../DynamicPricingTest.java
      · code:    src/main/.../DynamicPricing.java

  ⚠️  Test exists, production code missing
    REQ-008    SCN-008
      ✓ test:    src/test/.../SeasonalRateTest.java
      · code:    src/main/.../SeasonalRateService.java

  ⚠️  Artifacts present — run `specgate done <REQ>`
    REQ-009    SCN-009

  Next: read the feature file, write the test, write the code, then run `specgate done <REQ-id>`.
```

For AI agents, swap to JSON:

```bash
specgate plan --format json
```

```json
{
  "schema_version": 1,
  "total": 12,
  "pending": 3,
  "summary": { "NEEDS_EVERYTHING": 1, "NEEDS_IMPLEMENTATION": 1, "NEEDS_STATUS_UPDATE": 1, "DONE": 9 },
  "next_steps": [
    { "requirement": "REQ-007", "category": "NEEDS_EVERYTHING", "hint": "Read features/pricing/dynamic_pricing.feature, then write the test, then the production code." }
  ],
  "requirements": [],
  "orphan_features": []
}
```

### After implementing, mark the REQ done

```bash
specgate done REQ-007                          # → Status="Implemented"
specgate done REQ-007 --status Verified         # → Status="Verified"
specgate done REQ-007 --check                   # runs `validate` first; aborts on red
specgate done REQ-007 --strict                  # like --check but uses `validate --strict-tdd`
```

`done` edits exactly one cell in `docs/specs/traceability.md`. Combined with `validate --strict-tdd` in CI, the matrix is the live source of truth instead of a rear-view mirror.

### AI agent recipe (Claude Desktop / Cursor / Aider with MCP)

The MCP server exposes `plan` and `mark_requirement_done`. A canonical prompt:

```
1. Call the `plan` tool with projectDir set to my repo.
2. Pick the first item from next_steps.
3. Read the feature file (using `read_spec` or your editor).
4. Write the test file at the expected path. Run the test — confirm it fails.
5. Write production code until the test passes.
6. Run `validate_project` to confirm gates are green.
7. Call `mark_requirement_done` with that requirement id and check=true.
8. Repeat from step 1 until plan returns pending=0.
```

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

Tagging `@REQ-014` alone therefore fails, and says so:

```
✖ features/vets/listing.feature carries traceability tags but not @SCN-014,
  which REQ-014 declares. The matrix points at a scenario that is not there.
```

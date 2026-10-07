# Validating

The gate. `validate` is what makes a spec a contract rather than a
document — run it locally, then make it a required check.

---

## Run `validate` locally and in CI

**Goal:** make `validate` part of every PR.

Local:

```bash
npx @rsaglobaltech/specgate@latest validate .
```

GitHub Actions:

```yaml
# .github/workflows/specs.yml
name: Spec validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      # --strict-links is what checks the matrix against the filesystem: without
      # it a row pointing at a deleted test file still passes. Pin the version in
      # CI so a release cannot change the gate under a green branch.
      - run: npx --yes @rsaglobaltech/specgate@0.14.0 validate . --strict
```

What `validate` checks:

- required directories (`features/`, `docs/specs/`),
- required files (`spec.md`, `AI_RULES.md`, `traceability.md`, ADR entrypoint),
- at least one `.feature`,
- no unresolved `{{...}}` placeholders,
- traceability matrix header presence,
- every `.feature` appears in `traceability.md`,
- allowed traceability statuses,
- duplicate `Scenario ID` detection,
- expected `use-cases.md` and `events.md` headers when those files exist.

Exit codes: `0` ok · `1` unhandled · `2` usage · `3` missing prerequisite · `4` destination conflict.

### The one thing a pass does not tell you

A freshly adopted repository passes on day one — deliberately, because a gate
that rejects a new adoption is a gate nobody installs. So `validate` warns when
the only scenario in the project is still the baseline `adopt` wrote:

```
✅ Validation passed
⚠️ [WARN] Adoption never retro-filled — the only scenario is the adoption baseline.
```

It is a warning, not a failure: the exit code stays `0` and CI stays green. It
exists because the alternative is worse — a project that specified nothing
looking exactly like a healthy one at the only place most teams check. In
`--json`, `validation.adoptionRetrofilled` carries the same fact, alongside an
`adoption_not_retrofilled` advisory in `status[]`.

---

---

## The gate is `validate . --strict`

```bash
npx @rsaglobaltech/specgate@latest validate . --strict
```

One name, every check below. The individual `--strict-*` flags still work, so an
existing CI invocation keeps meaning what it meant — but `--strict` is what to
put in CI and what every other page recommends.

This matters more than it sounds. Ten places used to call `--strict-tdd` "the
gate" while only the generated workflow ran the stronger command, so anyone
following the documentation got a check that **passes on an `Implemented`
requirement whose test file does not exist**. One name that means all of them is
the fix; correcting the wording in ten places would have left the same trap for
the eleventh.

## Enforce TDD with `validate --strict-tdd`

**Goal:** fail PRs when a `REQ` that has started work has no scenario, no implementing test, or no row in `traceability.md`.

**`Draft` rows are exempt, on purpose.** A requirement nobody has started owes
nothing yet, so `--strict-tdd` skips it and the run reports how many it skipped:

```
- Strict TDD gate: passed (3 row(s) exempt — still Draft, so not checked)
```

A row starts being checked the moment its `Status` leaves `Draft`, which
`specgate done <REQ>` does. If you want the stricter reading — every declared
scenario proved, whatever the status — that is `--strict-coverage` below.

```bash
npx @rsaglobaltech/specgate@latest validate . --strict-tdd
```

### `--strict-coverage` — every scenario is actually proved

A matrix row names one `Scenario ID` and one feature file. The file may hold
five scenarios, and until this flag nothing related the other four to anything:

```bash
npx @rsaglobaltech/specgate@latest validate . --strict-coverage
```

```
❌ [ERROR] Declared scenarios nothing proves: 1
  ✖  Nothing proves "SCN-012 a fully discounted invoice carries no tax"
     fix: Add a test naming SCN-012 to tests/totals.test.js, or delete the
          scenario if it no longer describes behaviour this project promises.
```

This is the scenario an agent skips when it cannot satisfy it — measured: given
five scenarios where one contradicted another, an agent wrote tests for four,
the gate approved, and the row went to `Implemented`.

It matches a scenario's `@SCN-NNN` tag, the id in its title, or failing both the
title itself, against the test artifact the row declares. **It is a name match:
this does not run your suite.** That is why it is opt-in rather than part of
`--strict-tdd` — a project that names its tests some other way should not start
failing because a release shipped a heuristic.

`--strict-tdd` is in addition to the normal checks. It is intended for "no contract without a test" gates — particularly useful in `contracts` packs (see §8). Wire it into CI exactly like `validate`, just append the flag.

> A requirement that is not going to be delivered is `Deprecated` (`specgate done REQ-NNN --status Deprecated`): it owes nothing, and `--strict-tdd` skips it. One not started yet simply stays `Draft`.

## The other three gates

`--strict-tdd` is one of four opt-in gates. Every one of them is **additive** to
the normal checks and **off by default**, for the same reason: each one is
legitimate to fail while a project is still finding its shape, and a gate that
fires on honest work gets switched off for good.

Turn them on one at a time, in CI, once the repository is clean for that rule.

### `--strict-scenarios` — the scenarios say something falsifiable

Applies the pack's eight scenario quality rules to `features/**/*.feature`:

- No scenario Cucumber would see as empty. Upper-case `GIVEN`/`WHEN`/`THEN` is
  the usual cause — Gherkin keywords are case-sensitive, so the real parser
  absorbs them as description and the scenario runs zero steps and exits `0`.
- Every scenario has a `When` and a `Then`, at least three steps, and a title
  that names the behaviour.
- No vague, unfalsifiable step text; no `Scenario Outline` without `Examples`.

`specgate doctor` reports the same rules as advisories rather than failures, which
is the gradual path for a repository brought in with `specgate adopt`.

### `--strict-requirements` — the requirement states an obligation

Over `docs/specs/capabilities/**/spec.md`:

- Every requirement states an obligation — `SHALL`, `MUST`, `SHOULD`, `MAY`,
  `DEBE`, `DEBERÁ`.
- A requirement that opens with `IF` resolves with `THEN` in the same sentence.

**What it deliberately does not do:** parse EARS grammar. No regex can reliably
tell "the system" from a response clause, and a check that claims to enforce a
grammar it does not parse is worse than no check. These two rules are what a
regex can assert honestly — nothing wider.

The point is upstream of any code checking: `- Max 5 failed attempts per hour
per user` is not something a machine can hold code to. This gate makes the
requirement itself say something before anything tries to verify against it.

### `--strict-links` — the matrix points at files that exist

Every Feature file / Technical artifact / Test artifact the matrix declares as
a path still exists on disk. A cell may anchor a line range
(`src/auth/login.ts#L15-L89`); the anchor is not part of the path.

**Only delivered rows owe their files.** A `Draft` or `In Dev` row routinely
names the file a requirement is *going to* land in, before anyone writes it.
Planning ahead is not documentary drift, so the check applies to rows that are
`Implemented`, `Verified` or `Released`. A delivered row whose file has gone is
drift, and fails.

The same line applies to `--strict-scenarios`: the scenario rules are owed on
delivery — including `scenario_placeholder_step`, an unfilled `<placeholder>` in
a plain Scenario, which is what `specgate new` writes for you to fill in. The
three rules that make a suite report a pass it never ran — no steps, a keyword
in the wrong case, an Outline with no Examples — apply to every row.

`specgate done REQ-NNN --check` and `harness run` hold the requirement they are
closing to that rule before its status flips — otherwise they would skip the
one requirement they are about to mark `Implemented`.

---

---

## Declared-value drift — a report, not a gate

The one thing none of the four gates catches is the case where the spec and the
code both exist, both are consistent, and **disagree**: *session timeout is 30m
but the spec requires 15m*. `--strict-requirements` checks the shape of the
sentence; `--strict-links` checks that the file exists; neither reads what is
in it.

Annotate the value on both sides, and `specgate report` compares them:

```markdown
<!-- csda:trace uc=Login value_session_timeout=15m -->
```

```ts
// csda:value session_timeout=15m
```

`csda:value` is a plain literal string found by scanning line by line, so it
reads the same behind `//`, `#`, `--`, or no comment marker at all — the same
reason `csda:trace` works in any markdown file. Comparison is exact string
equality between two things a human or an agent wrote on purpose.

Each identifier lands in one of four states: **matched**, **diverging**,
**spec only**, **code only**. The report gains a section listing them with
`file:line` for the code side, and `--record` appends `valuesTotal`,
`valuesMatched` and `valuesDiverging` to the history — additive, so an older
history line simply lacks them.

**Why this is a report and not `--strict-values`.** Two reasons, both about
scale. Annotating every checkable fact is hand work that grows with the number
of facts while coverage does not; and the more complex a system gets, the
smaller the fraction of its requirements that reduce to a scalar at all. A hard
gate over a partial, hand-maintained set of annotations would mostly measure
who remembered to annotate. See ADR-0023.

**It does not interpret units.** `15m` and `900000` are different strings, and
this compares strings. Claiming otherwise would be asserting authority over two
grammars it does not parse.

### Acting on a divergence

Three routes, and only one of them needed a new command:

1. **Fix the code** — the report already gives `file:line`. Open it.
2. **Update the spec** — `specgate change new <id> --from-value-drift REQ-ID:value_id`
   writes the delta: the full requirement copied into a `## MODIFIED
   Requirements` section with `value_<id>` rewritten to the code's value.
   **The prose is not rewritten** — turning "expires after 15 minutes" into
   "after 30" would be guessing how a sentence should sound on someone's
   behalf, so it leaves an explicit `TODO:` instead. Review it, then
   `specgate change validate` and `specgate change archive` as usual.
3. **Retire the requirement** — already `specgate change new <id> --capability <cap>`
   with a `## REMOVED Requirements` section. The removal mechanism does not
   care why something is removed.

---

---

## Next

- [Automate the loop](automation.md)
- [Troubleshooting](troubleshooting.md)

**On a brownfield repository it says so instead of failing you.** Retro-fitting
specs onto tests written years earlier means pointing a row at a test that does
not mention any requirement — and the only way to satisfy a name match there
would be to edit that test, which is the one thing `adopt` promises never to
make you do. So the check calibrates: if no test artifact in the project names
its requirement or a scenario, the convention is not in use here and `validate`
reports that it could not run rather than failing every row.

```
⚠ --strict-coverage could not run: no test artifact in this project names its
  requirement or any of its scenarios.
```

Name one requirement in the test that proves it — a comment is enough — and the
check starts holding the rest of the matrix to the same standard.

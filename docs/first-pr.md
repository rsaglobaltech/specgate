# Your team's first pull request with Specgate

For the people who write the pull request and for the people who review it.
It assumes the repository has already run `specgate init`; if it has not, the
[Quickstart](quickstart.md) gets it there in ten minutes.

---

## Once per repository

```bash
specgate init        # adopts the existing code; writes spec.md and the matrix
specgate ci init     # the gate as a CI job — the provider is detected from
                     # .github/, .gitlab-ci.yml, … or the origin remote;
                     # with neither yet, add --provider github|gitlab|azure|jenkins
git add -A && git commit -m "chore: adopt Specgate"
```

The CI job runs `specgate validate . --strict` on every pull request — the
same gate `specgate check` runs on your machine. Your own test job keeps
running your tests; Specgate does not replace it.

---

## The author: one requirement, one pull request

```bash
specgate status                                   # what is open, and the next command
specgate new "Customers download invoices as PDF" # spec section + scenario + row
```

`new` writes three things. Edit two of them:

1. **`spec.md`, the `## REQ-NNN` section** — replace the generated sentence
   with the obligation: what must hold, when, and how someone would observe
   it. One requirement, one obligation.
2. **`features/<name>.feature`** — replace the three `<placeholders>` with a
   concrete Given / When / Then. Real values, not "valid data".
3. **`docs/specs/traceability.md`** — do not touch it. It is generated.

Then write the test, and **mention the requirement in it**. The mention is the
link; there is nothing else to declare:

```js
// REQ-007 SCN-007 — customers download invoices as PDF
test("a paid invoice downloads as a PDF", () => { /* … */ });
```

Write the code, then close the requirement:

```bash
specgate done REQ-007     # runs the gate for it first; writes nothing if it fails
specgate check            # the whole gate, the one CI runs
```

Commit everything `check` touched — `spec.md`, the feature file, the tests,
the code **and** `docs/specs/traceability.md`. A matrix left behind is the
most common red build on a first PR (see `matrix_stale` below).

### Fixes and refactors

A bugfix or a refactor that does not change contracted behaviour **needs no
new requirement**. The gate runs on every pull request, but it only asks for
what a delivered requirement owes; a PR that adds none owes nothing new.

If the fix changes what a delivered requirement promises, change its
`spec.md` section and scenario in the same PR. For a larger change to
behaviour that already shipped, use a [change](reviewing-changes.md).

---

## The reviewer: what to read, what to skip

The gate already proved the mechanical part: every delivered requirement has
a scenario, the scenario has real steps, a test names it, and the files the
matrix points at exist. **Do not re-check that by hand.** Spend the review on
what no tool can judge:

| Read | Ask |
|---|---|
| The `## REQ-NNN` section in `spec.md` | Is it one obligation? Could two people test it and agree? Is it what the ticket asked for? |
| The scenario | Do Given / When / Then describe *this* behaviour with real values, or a generic happy path? Is the interesting edge case missing? |
| The test that mentions `REQ-NNN` | Does it assert what the scenario's *Then* says — or only that nothing throws? A test that mentions the ID and checks nothing passes the gate. |
| The status change | `csda:trace … status=Implemented` in `spec.md`. Only on a requirement whose code is in this PR. |

Skip `docs/specs/traceability.md`. It is generated from the files above, and
CI fails when it is out of date, so a diff there is a consequence, not a
decision.

The one thing the gate cannot catch is a test that names a requirement and
does not test it. That is the reviewer's job, and it is the most valuable
five minutes of the review.

---

## When `check` fails

Every failure says what is wrong and how to fix it, and most carry a code in
brackets you can search for. The ones a first PR meets:

### `scenario_placeholder_step`

```
✖  features/invoices.feature:4 unfilled placeholder in "given <the state before the action>" … [scenario_placeholder_step]
```

The scenario still has the `<placeholders>` `new` wrote. A Draft requirement
may keep them; one being delivered may not, because Cucumber reports a
scenario of placeholders as `0 steps · exit 0`. Write the real steps.

### `matrix_stale`

```
❌ [ERROR] docs/specs/traceability.md no longer matches spec.md, the feature tags and the tests.
💡 [FIX] Run `specgate matrix` and commit the result — `specgate check` does it for you.
```

Only in CI: a test or a tag changed and the regenerated matrix was not
committed. Run `specgate check` locally and commit `traceability.md`.

### `[TDD-1]` — delivered without a test

```
[TDD-1] Test artifact is TBD but status is 'Implemented' (scenario: SCN-007)
```

The requirement is past Draft and no test mentions it — usually the test was
renamed or deleted. Mention `REQ-007` in the test that covers it, or move the
status back to Draft in `spec.md`.

### `declared_artifact_missing`

```
✖  docs/specs/traceability.md REQ-007's test artifact `test/invoice.test.js` does not exist. [declared_artifact_missing]
```

A file the requirement points at *explicitly* is gone — a path written in its
`csda:trace` comment (`test='…'`, `artifact='…'`), or in a hand-kept matrix.
Restore it, or fix the path. A test linked only by mentioning the requirement
does not produce this: delete that test and you get `[TDD-1]` instead.

### `check_tests_failed` / `done_tests_failed`

The project's tests failed. These run only when a test command is configured
(`--test-cmd "npm test"`, or `test_cmd:` in `harness.config.yaml`). Without
one, `check` and `done` say they checked the specification and not the code —
read that warning as "nothing ran", not as a pass.

### `done_validate_failed`

`done` ran the gate and it failed; the output above it says why. Nothing was
written. Fix it and run `done` again. `done --no-check` writes the status
anyway — keep it for the rare case you know the gate is wrong, and say so in
the PR.

---

## The agreement to make as a team

Three sentences are enough. Put them in the repository's contributing guide:

1. A pull request that delivers behaviour carries its requirement, its
   scenario and a test that mentions it.
2. `specgate check` is green before review is requested.
3. The reviewer reads the requirement, the scenario and the test — not the
   matrix.

---

## Next

- [The five commands, and the rest](commands.md)
- [Write a scenario that is worth testing](writing-specs.md)
- [Change a requirement that already shipped](reviewing-changes.md)
- [What the gate checks, flag by flag](validating.md)

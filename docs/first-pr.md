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

The CI job runs `specgate check` on every pull request — the specification,
then your tests — after setting up what the project needs: a JDK for a
`pom.xml` or `build.gradle`, `npm ci` for a lockfile. It is the `check` you run
on your machine, so a green there is a green in CI. It runs the `test_cmd` you
configured (`specgate config set test_cmd …`), or the one it detects; with
neither, it runs `validate . --strict` alone and `ci init` says so.

### Make the gate a required check

A red CI job only blocks a merge when the repository requires it. On GitHub,
open **Settings → Branches**, add a protection rule for the branch pull
requests target (`main`, and `develop` if you use it), and turn on:

1. **Require a pull request before merging.**
2. **Require status checks to pass before merging**, then search for and
   select the job `specgate ci init` wrote, `spec-gate`. It appears in the list
   once it has run on one pull request.

GitLab (protected branches, "Pipelines must succeed") and Azure DevOps (a
build validation branch policy) have the same setting. Without it, a pull
request can be merged while the gate is red.

---

## The author: one change, one pull request

```bash
specgate status                     # what is open, and the next command
specgate propose invoices-pdf       # proposal, tasks, a delta, REQ ids reserved
```

`propose` opens `docs/specs/changes/invoices-pdf/`. Write two things in it:

1. **`proposal.md`** — why the change exists, in a paragraph. The reviewer
   reads it first.
2. **The delta, `specs/invoices-pdf/spec.md`** — each requirement as
   `### Requirement: REQ-007 — <name>`, one obligation with `SHALL` or `MUST`,
   and a scenario of plain `- GIVEN` / `- WHEN` / `- THEN` bullets with real
   values, not "valid data". `check` fails while a step still has its
   `<placeholder>` (`scenario_steps_unwritten`).

Leave `docs/specs/traceability.md` alone. It is generated.

Then write the test, and **mention the requirement in it**. The mention is the
link; there is nothing else to declare:

```js
// REQ-007 SCN-007a — customers download invoices as PDF
test("a paid invoice downloads as a PDF", () => {
  /* … */
});
```

Write the code, then deliver the requirement and close the change:

```bash
specgate apply                      # the next requirement: refused while no test names it,
                                    # Implemented only when the gate passes
specgate archive invoices-pdf       # every requirement Implemented: merged into the specs
specgate check                      # the whole gate, the one CI runs
```

While the change is open its requirements already count: `status` lists
them, `apply` judges the project as it will be after archive and writes the
status in the delta. `archive` refuses while one is still pending, naming the
`specgate apply REQ-…` to run. So the spec and the code merge together, in
this pull request, after the gate passed.

Commit everything `archive` and `check` touched — the change folder moved to
`docs/specs/changes/archive/`, the capability spec, the feature file, the
tests, the code **and** `docs/specs/traceability.md`. A matrix left behind is
the most common red build on a first PR (see `matrix_stale` below).

A requirement too small for a change: `specgate new "<title>"` writes it
straight into `spec.md` with a scenario to fill in, and `specgate apply
REQ-007` delivers it the same way.

### From a ticket

When the work is a Jira story, the same pull request starts from the ticket.
The differences:

- Open the change with `specgate propose --from-ticket KAN-13`. It creates and
  pushes the branch `feature/KAN-13-…`.
- Start every commit message with the key: `KAN-13 REQ-151: normalize plates`.
- Run `specgate archive <change-id>` on the branch, commit, then open the pull
  request with `specgate alm pr <change-id>`. Archive comes first, so the spec
  and the code reach review together.

The setup and the full loop are in [From a Jira ticket](from-a-ticket.md).

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

| Read                                  | Ask                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The `## REQ-NNN` section in `spec.md` | Is it one obligation? Could two people test it and agree? Is it what the ticket asked for?                                                    |
| The scenario                          | Do Given / When / Then describe _this_ behaviour with real values, or a generic happy path? Is the interesting edge case missing?             |
| The test that mentions `REQ-NNN`      | Does it assert what the scenario's _Then_ says — or only that nothing throws? A test that mentions the ID and checks nothing passes the gate. |
| The proposal and the status           | `proposal.md` says why. Each requirement is `Implemented` — `archive` would not have run otherwise — and its code is in this PR.              |

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

A feature file still has the `<placeholders>` `new` wrote. A Draft requirement
may keep them; one being delivered may not, because Cucumber reports a
scenario of placeholders as `0 steps · exit 0`. Write the real steps.

In a change's delta the same problem is `scenario_steps_unwritten`, and it
fails `check` as soon as the change is open (`check_change_invalid`): write the
scenario before you push the change.

### `matrix_stale`

```
  ✖  docs/specs/traceability.md no longer matches spec.md, the feature tags and the tests.
     Run `specgate matrix` and commit the result — `specgate check` does it for you.
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

A file the requirement points at _explicitly_ is gone — a path written in its
`specgate:trace` comment (`test='…'`, `artifact='…'`), or in a hand-kept matrix.
Restore it, or fix the path. A test linked only by mentioning the requirement
does not produce this: delete that test and you get `[TDD-1]` instead.

### `requirement_template_obligation`

The requirement claims delivery while its `## REQ-NNN` section still says
"The system MUST satisfy: <title>." with the note `specgate new` left below it. Write
the real obligation and delete the note. A Draft owes nothing yet.

### `check_tests_failed` / `done_tests_failed`

The project's tests failed. These run only when a test command is configured
(`--test-cmd "npm test"`, or `specgate config set test_cmd "npm test"` once). Without
one, `check` and `apply` say they checked the specification and not the code —
read that warning as "nothing ran", not as a pass.

### `apply_no_test`

No test mentions the requirement yet. Name it in the test that covers it
(`REQ-007`, and its scenario `SCN-007a`), then run `specgate apply REQ-007`
again.

### `done_validate_failed`

`apply` ran the gate and it failed; the output above it says why. Nothing was
written. Fix it and run `apply` again. `apply --no-check` writes the status
anyway — keep it for the rare case you know the gate is wrong, and say so in
the PR.

### `archive_requirements_pending`

`archive` found a requirement of the change that is not `Implemented`. Run
the `specgate apply REQ-…` it names; `--force` does not skip this.

---

## The agreement to make as a team

Three sentences are enough. Put them in the repository's contributing guide:

1. A pull request that delivers behaviour carries its requirement, its
   scenario and a test that mentions it — as a change, archived in the same
   pull request.
2. `specgate check` is green before review is requested.
3. The reviewer reads the requirement, the scenario and the test — not the
   matrix.

---

## Next

- [The four verbs, and the rest](commands.md)
- [Write a scenario that is worth testing](writing-specs.md)
- [Change a requirement that already shipped](reviewing-changes.md)
- [What the gate checks, flag by flag](validating.md)

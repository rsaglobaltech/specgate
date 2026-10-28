# Validating

At the end of this page the gate runs on your machine before every pull
request, and in CI as a required check that blocks a merge when it fails. The
**gate** is the set of checks that decides whether the specification and the
code still agree.

**You need:** a project where `specgate init` has run, Specgate installed as a
dev dependency (`npm install --save-dev @rsaglobaltech/specgate`), and, for the
CI part, a repository on GitHub, GitLab, Azure DevOps or Jenkins.

## Run the gate on your machine: `specgate check`

```bash
specgate check
```

`check` runs four things, in order, and stops at the first failure:

1. `validate --strict`: specs, scenarios, traceability, links and coverage.
2. Your architecture check, if you set one with
   `specgate config set arch_cmd "<cmd>"` (ArchUnit, dependency-cruiser, …).
   With `arch_sarif:` beside it, only a violation the change adds fails.
3. Your tests, from `specgate config set test_cmd "npm test"` or `--test-cmd`.
4. Your [quality checks](quality.md), if `specgate quality init` wrote them:
   coverage and mutation of what the change adds, SAST, secrets, dependencies,
   Conventional Commits — each in Docker. `--ci` adds the CI-only ones and
   fails a check that cannot run.

Without a test command, `check` still passes and says it checked the
specification, not the code. Set one.

`check` also compares requirement ids with the base branch (`--base <branch>`,
or origin's default branch). The same id with a different title there fails
the gate as `id_taken_on_base`, before two pull requests collide on merge.

Run `check` before every pull request. `specgate apply` runs the same gate for
the one requirement it delivers.

## Run it in CI

The quickest way is to let Specgate write the job:

```bash
specgate ci init
```

It detects your CI provider (GitHub, GitLab, Azure or Jenkins), sets up the
project's toolchain (Node, or a JDK for Maven and Gradle) and runs
`specgate check` at the version you have installed, so a green on your machine
is a green in CI. On GitHub the job is called `spec-gate`.

If you write the job by hand, run `validate --strict` and pin the version. A
release can change what the gate checks, and a pipeline should not change
under a green branch:

```yaml
# .github/workflows/specs.yml
name: Spec gate
on: [push, pull_request]
jobs:
  spec-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      # --strict is the whole specification gate, pinned so a release
      # cannot change it under you. It does not run your tests.
      - run: npx --yes @rsaglobaltech/specgate@0.26.0 validate . --strict
```

`validate --strict` checks the specification only. To fail the job when the
tests fail as well, run `check` instead, as the generated job does.

## Make it a required check

A CI job that fails does not stop a merge on its own. On GitHub:

1. Push a branch once, so GitHub has seen the `spec-gate` job run.
2. Open **Settings → Branches** (or **Settings → Rules → Rulesets**) and add a
   rule for your main branch, and for `develop` if you use one.
3. Turn on **Require status checks to pass before merging** and select
   `spec-gate`, plus any other CI jobs you rely on.
4. Save. A pull request with a red gate can no longer be merged.

GitLab, Azure DevOps and Jenkins have the same setting under their own names
(protected branches, branch policies, required builds).
[Your team's first pull request](first-pr.md) covers what the author and the
reviewer do once the check is in place.

## What `validate` checks

Plain `specgate validate .` checks the structure every project needs:

- the `features/` and `docs/specs/` directories,
- `spec.md`, `AGENTS.md`, the traceability matrix and the ADR index,
- at least one `.feature` file, and no unresolved `{{...}}` placeholders,
- every `.feature` file appears in the matrix, with an allowed status,
- no duplicate scenario ids,
- the deltas of every open change.

Exit code `0` means it passed, including with warnings; `1` means it found
something.

### What `--strict` adds

`--strict` is the gate. It adds five checks in one flag:

| Check | What fails |
| --- | --- |
| TDD | A requirement past Draft with no test, no scenario or no matrix row. |
| Scenarios | A scenario that cannot fail: no steps, no `When`/`Then`, vague steps. |
| Requirements | A requirement that states no obligation (`SHALL`, `MUST`, …). |
| Links | A delivered row that points at a file that no longer exists. |
| Coverage | A declared scenario that no test names. |

Each check also has its own flag (`--strict-tdd`, `--strict-scenarios`,
`--strict-requirements`, `--strict-links`, `--strict-coverage`), so an existing
pipeline keeps meaning what it meant. Use `--strict` in anything new: one of
the individual flags alone passes a requirement whose test file does not exist.

The details of each check follow.

### TDD: Draft requirements owe nothing yet

A requirement nobody has started is exempt, and the run says how many it
skipped:

```
- Strict TDD gate: passed (3 row(s) exempt — still Draft, so not checked)
```

A requirement is checked from the moment its status leaves Draft, which is
what `specgate apply` does. A requirement you will not deliver is marked
Deprecated (`specgate apply REQ-NNN --status Deprecated`) and is skipped too.

### Scenarios: each one can fail

Over `features/**/*.feature`:

- No scenario that Cucumber would see as empty. Upper-case `GIVEN`/`WHEN`/`THEN`
  is the usual cause: Gherkin keywords are case-sensitive, so the scenario runs
  zero steps and passes.
- Every scenario has a `When` and a `Then`, at least three steps and a title
  that names the behaviour.
- No vague step text, and no `Scenario Outline` without `Examples`.

`specgate doctor` reports the same rules as warnings, which is the gradual path
for a repository you brought in with `specgate adopt`.

### Requirements: each one states an obligation

Over `docs/specs/capabilities/**/spec.md`, every requirement uses `SHALL`,
`MUST`, `SHOULD`, `MAY`, `DEBE` or `DEBERÁ`, and one that opens with `IF`
resolves with `THEN` in the same sentence. It does not parse EARS grammar: these
two rules are what a pattern match can check honestly.

### Links: delivered rows point at real files

Every feature file, technical artifact and test artifact a delivered row
(`Implemented`, `Verified` or `Released`) names must exist. A Draft row may
name a file that is not written yet. A path may carry a line range
(`src/auth/login.ts#L15-L89`); the range is not part of the path.

The scenario rules work the same way: most are owed on delivery, including
`scenario_placeholder_step`, the `<placeholder>` that `specgate new` leaves for
you to fill in. The three that make a suite report a pass it never ran (no
steps, a keyword in the wrong case, an Outline with no Examples) apply to every
row.

### Coverage: every scenario is named by a test

A matrix row names one scenario and one feature file, but the file may hold
five scenarios. Coverage checks each of them:

```
  ✖  Declared scenarios nothing proves: 1
  ✖  Nothing proves "SCN-012 a fully discounted invoice carries no tax"
     fix: Add a test naming SCN-012 to tests/totals.test.js, or delete the
          scenario if it no longer describes behaviour this project promises.
```

This catches the scenario an agent skips when it cannot satisfy it. It matches
a scenario's `@SCN-NNN` tag, the id in its title, or the title itself against
the test the row declares. It is a name match and does not run your suite.

On a repository adopted with tests written years earlier, no test names a
requirement yet. Then the check reports that it could not run instead of
failing every row:

```
⚠ --strict-coverage could not run: no test artifact in this project names its
  requirement or any of its scenarios.
```

Name one requirement in the test that proves it (a comment is enough), and the
check starts holding the rest of the matrix to the same standard.

## A pass on a freshly adopted repository

A repository passes the gate on the day you adopt it, so that adopting never
breaks a build. `validate` warns while the only scenario is still the baseline
that `adopt` wrote:

```
✅ Validation passed
  ▲  Adoption never retro-filled — the only scenario is the adoption baseline.
```

The exit code stays `0`. In `--json`, `validation.adoptionRetrofilled` carries
the same fact, with an `adoption_not_retrofilled` advisory in `status[]`.

## Declared-value drift: a report, not a gate

The gate cannot tell when the spec and the code both exist and disagree, for
example a session timeout of 30 minutes in the code and 15 in the spec.
Annotate the value on both sides, and `specgate report` compares them:

```markdown
<!-- specgate:trace uc=Login value_session_timeout=15m -->
```

```ts
// specgate:value session_timeout=15m
```

`specgate:value` is found line by line, behind any comment marker. The
comparison is exact string equality: `15m` and `900000` are different values.
Each value is **matched**, **diverging**, **spec only** or **code only**, and
`specgate report --record` adds the totals to the report history.

It is a report rather than a gate because annotations cover only the values
someone chose to annotate; a hard gate over them would mostly measure who
remembered ([ADR-0023](specs/adr/0023-checking-content-gate-or-report.md)).

When a value diverges, you have three options:

1. **Fix the code.** The report gives the file and line.
2. **Update the spec.** `specgate propose <id> --from-value-drift REQ-ID:value_id`
   opens a change whose delta carries the code's value. It leaves the prose with
   a `TODO:` for you to reword. Review it, deliver the requirement with
   `specgate apply`, and `specgate archive <id>` when it is Implemented.
3. **Retire the requirement.** Open a change with `specgate propose <id>` and
   list it under `## REMOVED Requirements`.

## Next

- [Your team's first pull request](first-pr.md)
- [Automation](automation.md)

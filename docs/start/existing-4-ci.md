# Existing project · 4 — Put the gate in CI

<!-- specgate:goal -->
**When you finish:** every pull request runs the gate, so a requirement marked done can
never again sit on red code — and adopting it does not ask you to fix the
past first.
<!-- specgate:endgoal -->

| Who | Does what in this phase |
| --- | --- |
| **You** | Generate the CI job and commit it |
| **CI** | Runs `specgate check` on every pull request |

## 1. Generate the job

```bash
specgate ci init --provider github
```

<!-- specgate:out-existing-ci:begin — generated; edit the source, not this block -->
```text
$ specgate ci init --provider github
  ◆ specgate · ci init   github

    + .github/workflows/spec-gate.yml

  ✔  CI gate installed. On every PR/MR the job:
   1  runs `specgate check` — the specification, then the tests, as locally
     runs your tests: `node --test` (test_cmd)
   2  runs `validate --against-lock` when .specops.lock exists, so a
     moved pack tag or an edited generated file fails the build
   3  publishes `plan --format json` as the spec-plan artifact
  ℹ  Commit the file and open a PR to see the gate in action.
```
<!-- specgate:out-existing-ci:end -->

`gitlab`, `azure` and `jenkins` work the same way. If you already have a
workflow, `--stdout` prints the job to paste into it instead.

## 2. Check locally what CI will run

```bash
specgate check
```

<!-- specgate:out-existing-check-green:begin — generated; edit the source, not this block -->
```text
$ specgate check
  ◆ specgate · check   invoicing

  ✔  Specification   validate --strict
  ✔  Tests           node --test

  ✔  Gate passed — the specification and `node --test`
```
<!-- specgate:out-existing-check-green:end -->

Note what makes this safe on old code: requirements still in `Draft` — the
adoption's proposals, anything not described yet — are **exempt**, and the
output says how many. The gate holds the code to what you have written down,
and only that. Each requirement you close raises the bar by one.

## 3. Commit and open a pull request

```bash
git add -A && git commit -m "Specgate: the gate in CI, REQ-004 closed"
```

The first pull request shows the job running your specification and your
suite. From then on, a pull request that breaks REQ-004's rounding fails —
with the requirement's id in the failure.

## Already on OpenSpec?

If the project keeps its specs in `openspec/`, `specgate verify --since
origin/main` gates only what OpenSpec changes claim from now on, and older
claims are reported, not failed. It has its own CI action; see
[Already on OpenSpec](../openspec.md).

## You're done when…

- The CI file is committed and the job is green on a pull request.
- A deliberately broken test makes the job fail (try it once).

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `…already exists — refusing to overwrite.` | You have a workflow file at that path | `--stdout` and paste the job in, or `--force` |
| `Unknown provider: circleci` | Not a supported provider | Run `npx @rsaglobaltech/specgate@latest check` as a step in any CI |
| The job passes locally, fails in CI | CI lacks your test toolchain | Install it before the `check` step |

**[Next: phase 5 — every day →](existing-5-every-day.md)**

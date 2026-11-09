# Existing project · 4 — Put the gate in CI

<!-- specgate:goal -->
**When you finish:** every pull request runs the gate, so a requirement marked done can
never again sit on red code — and adopting it does not ask you to fix the
past first.
<!-- specgate:endgoal -->

**Before you start:** [phase 3](existing-3-first-requirement.md) is done —
REQ-004 is applied and its change archived. The project is on a Git host with
CI (GitHub, GitLab, Azure DevOps or Jenkins).

| Who | Does what in this phase |
| --- | --- |
| **You** | Commit the CI file `adopt` wrote, and see what it checks |
| **CI** | Runs `specgate check` on every pull request |

## 1. The gate is already in CI

`specgate adopt` (or `init` in a folder with code) wrote it:
`.github/workflows/spec-gate.yml`, or the file for the CI your repository
already uses — never over a file that exists. See what it checks, and what it
lacks:

```bash
specgate ci status
```

<!-- specgate:out-existing-ci:begin — generated; edit the source, not this block -->
```text
$ specgate ci status
  ◆ specgate · ci status   .github/workflows/spec-gate.yml

  ✔  the specification (validate --strict)
  ✔  the project's tests (check runs test_cmd)
  ✔  the architecture check (check runs arch_cmd)
  ✔  Ubuntu, macOS and Windows
  ✔  the requirement ids against the base branch (check --base)
  ✔  the quality checks (quality run)
  ✔  the pack drift (validate --against-lock)
  ✔  the pending-work plan (plan --format json)

  ✔  Everything specgate can check runs in CI.
```
<!-- specgate:out-existing-ci:end -->

An older `specgate init` wrote `.github/workflows/specs.yml`, which only
validated the specification: `specgate ci init --provider github` shows what
the gate adds, and `--replace` replaces it. Every step of the gate says what
it checks and what to delete to remove it; `--minimal` writes one step only.

## 2. Check locally what CI will run

```bash
specgate check
```

<!-- specgate:out-existing-check-green:begin — generated; edit the source, not this block -->
```text
$ specgate check
  ◆ specgate · check   invoicing

  ·  Ids            not compared with a base — no base branch (pass --base <branch>)
  ✔  Specification   validate --strict
  ✔  Tests           node --test
  ·  Architecture    not checked — specgate config set arch_cmd "<command>"

  ✔  Gate passed — the specification and `node --test`
```
<!-- specgate:out-existing-check-green:end -->

This is what makes the gate safe on old code: requirements still in `Draft`
— the adoption's proposals, anything not described yet — are **exempt**. The
gate holds the code to what you have written down, and only that. Each
requirement you apply raises the bar by one.

The job runs `specgate check` with the ids compared to the base branch and,
once [quality checks](../quality.md) are configured, `specgate quality run
--stage ci` on Ubuntu, where Docker runs.

## 3. Commit and open a pull request

```bash
git add -A && git commit -m "Specgate: the gate in CI"
```

The first pull request shows the job running your specification and your
suite. From then on, a pull request that breaks REQ-004's rounding fails —
with the requirement's id in the failure.

## 4. Make the job a required check

A failing job only blocks a merge when the branch requires it. On GitHub:
**Settings → Branches → Branch protection rules**, protect your main branch,
and add the gate's job under **Require status checks to pass before merging**.
GitLab and Azure DevOps have the same setting for merge requests and pull
requests.

## Already on OpenSpec?

If the project keeps its specs in `openspec/`, `specgate verify --since
origin/main` gates only what OpenSpec changes claim from now on, and older
claims are reported, not failed. It has its own CI action; see
[Already on OpenSpec](../openspec.md).

## You're done when…

- The CI file is committed and the job is green on a pull request.
- The job is a required check on your main branch.
- A deliberately broken test makes the job fail (try it once).

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `…already exists — refusing to overwrite.` | You have a workflow file at that path | `--stdout` and paste the job in, or `--force` |
| `Unknown provider: circleci` | Not a supported provider | Run `npx @rsaglobaltech/specgate@latest check` as a step in any CI |
| The job passes locally, fails in CI | CI lacks your test toolchain | Install it before the `check` step |

## Next

**[Phase 5 — every day →](existing-5-every-day.md)**

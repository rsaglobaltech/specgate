# Existing project · 4 — Put the gate in CI

**Existing project:** [1 Adopt](existing-1-adopt.md) → [2 Specify](existing-2-specify.md) →
[3 First requirement](existing-3-first-requirement.md) → **4 CI** →
[5 Every day](existing-5-every-day.md) · 10 minutes

**Goal:** every pull request runs the gate, so a requirement marked done can
never again sit on red code — and adopting it does not ask you to fix the
past first.

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
ℹ️ [INFO] write .github/workflows/spec-gate.yml
ℹ️ [INFO] ✅ CI gate installed. On every PR/MR the job:
ℹ️ [INFO]   1. runs `specgate check` — the specification, then the tests, as locally
ℹ️ [INFO]      runs your tests: `node --test` (test_cmd)
ℹ️ [INFO]   2. runs `validate --against-lock` when .specops.lock exists, so a
ℹ️ [INFO]      moved pack tag or an edited generated file fails the build
ℹ️ [INFO]   3. publishes `plan --format json` as the spec-plan artifact
ℹ️ [INFO] Commit the file and open a PR to see the gate in action.
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
ℹ️ [INFO] ✅ Validation passed
ℹ️ [INFO] - Features detected: 2
ℹ️ [INFO] - Base SDD structure: complete
ℹ️ [INFO] - Traceability mode: rich
ℹ️ [INFO] - Strict TDD gate: passed (2 row(s) exempt — still Draft, so not checked)
💡 [FIX] A Draft row owes nothing yet, so --strict-tdd skips it. It starts being
💡 [FIX] checked the moment its Status leaves Draft — `specgate done <REQ>` does that.

✔ numbers run per year (12ms)
✔ REQ-004: three lines at 21% VAT are rounded to the cent (12ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1.234

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

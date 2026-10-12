# Existing project · 1 — Adopt, touching no code

**Existing project:** **1 Adopt** → [2 Specify](existing-2-specify.md) →
[3 First requirement](existing-3-first-requirement.md) → [4 CI](existing-4-ci.md) →
[5 Every day](existing-5-every-day.md) · about 5 minutes

**Goal:** Specgate set up on a codebase that already works, without changing
a line of it, and a gate that passes with your existing tests.

The example is a small Node invoicing service with two modules
(`src/invoices`, `src/customers`) and its own tests. Maven, Gradle, Go,
Python, Cargo and .NET projects go the same way.

| Who | Does what in this phase |
| --- | --- |
| **You** | Run four commands, read what they propose |
| **Specgate** | Reads the build file and the layout; writes specification files only |
| **The gate** | Runs your existing suite, to prove the wiring |

## 1. Look before writing anything — `specgate onboard`

```bash
cd your-existing-repo
npx @rsaglobaltech/specgate@latest onboard
```

<!-- specgate:out-existing-onboard:begin — generated; edit the source, not this block -->
```text
$ specgate onboard
  🧭 onboarding  ~/invoicing

  1. What this is
     stack:  Node.js
     tests:  npm test
     detected from package.json

  2. Specs
     · not adopted yet — `specgate adopt` writes the skeleton without touching code

  3. Capabilities this codebase already implies
     · Invoices             src/invoices  (2 files)
     · Customers            src/customers  (1 files)

     A proposal, not a verdict. Merge, split or rename them.

  Next
     specgate adopt
```
<!-- specgate:out-existing-onboard:end -->

`onboard` writes nothing. It names the stack and test command it found, and
the capabilities your layout already implies — a proposal to argue with, not
a verdict.

## 2. Adopt — `specgate init`

```bash
specgate init
```

<!-- specgate:out-existing-init:begin — generated; edit the source, not this block -->
```text
$ specgate init
ℹ️ [INFO] Existing code found (package.json) — adopting this repository in place. Nothing in your code is touched.
ℹ️ [INFO] To scaffold a separate new project instead: specgate init --new
ℹ️ [INFO] 🔍 Stack detection: package.json
ℹ️ [INFO] - Project: invoicing
ℹ️ [INFO] - Stack: Node.js
ℹ️ [INFO] - Test command: npm test
ℹ️ [INFO] write spec.md
ℹ️ [INFO] write features/adoption/baseline.feature
ℹ️ [INFO] write docs/specs/traceability.md
ℹ️ [INFO] write docs/specs/adr/README.md
ℹ️ [INFO] write AGENTS.md
ℹ️ [INFO] write README.md (was missing)
ℹ️ [INFO] - Traceability: generated from spec.md, tags and tests (`specgate matrix`)
ℹ️ [INFO] 📋 Summary
ℹ️ [INFO] - Files written: 6
ℹ️ [INFO] - Files skipped (already present): 0
ℹ️ [INFO] - Requirements seeded: 2 proposal(s) from the layout — invoices, customers
⚠️ [WARN] This does not certify your code yet — it certifies the skeleton.
ℹ️ [INFO]   A green `validate` right now means the structure is in place, not that any
ℹ️ [INFO]   behaviour is covered. It starts meaning something when the requirements below
ℹ️ [INFO]   are real and their scenarios are linked to tests.
ℹ️ [INFO] ✅ Adoption completed. Next steps:
ℹ️ [INFO]   1. specgate check               # the gate — should pass right now
ℹ️ [INFO]   2. Argue with the seeded proposals in spec.md — each one names its evidence
ℹ️ [INFO]   3. specgate status              # what each requirement still needs
ℹ️ [INFO]   4. specgate ci init             # put the gate in CI
ℹ️ [INFO] Agent: none detected. To drive the daily loop from your agent:
ℹ️ [INFO]   specgate agents init --tool claude   # or cursor, copilot, gemini, … (--help)
```
<!-- specgate:out-existing-init:end -->

`init` (the same as `adopt` on a repository with code) writes `spec.md`,
`AGENTS.md`, a baseline scenario and the generated traceability matrix — and
only files that do not exist yet. It seeds one **proposed** requirement per
capability (`REQ-002 Invoices`, `REQ-003 Customers`), each marked as a guess,
each `Draft`, so nothing claims to be specified or verified.

## 3. Tell it how to run your tests

```bash
specgate config set test_cmd "node --test"
```

<!-- specgate:out-existing-test-cmd:begin — generated; edit the source, not this block -->
```text
$ specgate config set test_cmd "node --test"
  ✔  test_cmd = node --test
     harness.config.yaml
     `check` and `done` now run it.
```
<!-- specgate:out-existing-test-cmd:end -->

## 4. Run the gate

```bash
specgate check
```

<!-- specgate:out-existing-check:begin — generated; edit the source, not this block -->
```text
$ specgate check
ℹ️ [INFO] ✅ Validation passed
ℹ️ [INFO] - Features detected: 1
ℹ️ [INFO] - Base SDD structure: complete
ℹ️ [INFO] - Traceability mode: rich
ℹ️ [INFO] - Strict TDD gate: passed (2 row(s) exempt — still Draft, so not checked)
⚠️ [WARN] Adoption never retro-filled — the only scenario is the adoption baseline.
💡 [FIX] A Draft row owes nothing yet, so --strict-tdd skips it. It starts being
💡 [FIX] checked the moment its Status leaves Draft — `specgate done <REQ>` does that.
💡 [FIX] This passes, but it certifies the skeleton, not the code.
💡 [FIX]   specgate onboard                     # what this codebase already implies
💡 [FIX]   specgate new "<behaviour>"            # one requirement you already rely on
💡 [FIX]   # then a test that mentions REQ-NNN, and: specgate done REQ-NNN

✔ numbers run per year (12ms)
✔ three lines at 21% VAT are rounded to the cent (12ms)
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
<!-- specgate:out-existing-check:end -->

Green, with your own tests in it — and a warning that is honest: so far this
certifies the skeleton, not the code. Phase 2 changes that.

## You're done when…

- `specgate check` ends with `✔  Gate passed` and your test command.
- `git diff` shows new specification files and **no change** under `src/` or your tests.

## Variations

- **Detection was wrong:** `specgate adopt --var STACK="Spring Boot 3, Java 21" --var TEST_CMD="./mvnw -B verify"`.
- **No proposals wanted:** `specgate init --no-capabilities`.
- **A monorepo** (Maven/Gradle modules, npm or pnpm workspaces, Cargo members,
  Go modules): `specgate adopt --monorepo` adopts each module and writes
  `specops.config.yaml`; `specgate validate .` then prints one line per module.
- **Already on OpenSpec:** you may not need to adopt at all — `specgate verify`
  gates OpenSpec's archived changes on tests. See [Already on OpenSpec](../openspec.md).

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `The gate failed` with your tests red | Your suite was already failing | Fix or skip those tests first — the gate will not certify a red suite |
| `Gate passed — the specification` and *"nothing here runs your tests"* | No test command | `specgate config set test_cmd "<your command>"` |
| A new `<slug>/` folder appeared | No build file was found, so `init` scaffolded | Run it at the repository root, where the build file is; or `adopt --var STACK=…` |

Want the whole path on one page first? [A worked example: one service adopted end to end](../case-studies/case-1.md).

**[Next: phase 2 — write down what you rely on →](existing-2-specify.md)**

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
  ◆ specgate · init

  ℹ  Existing code found (package.json) — adopting this repository in place. Nothing in your code is touched.
  ℹ  To scaffold a separate new project instead: specgate init --new

  Stack detection: package.json ──────────────────────────
    · Project: invoicing
    · Stack: Node.js
    · Test command: npm test
    + spec.md
    + features/adoption/baseline.feature
    + docs/specs/traceability.md
    + docs/specs/adr/README.md
    + AGENTS.md
    + README.md   was missing
    · Traceability: generated from spec.md, tags and tests (`specgate matrix`)

  Summary ────────────────────────────────────────────────
    · Files written: 6
    · Files skipped (already present): 0
    · Requirements seeded: 2 proposal(s) from the layout — invoices, customers
  ▲  This does not certify your code yet — it certifies the skeleton.
     A green `validate` right now means the structure is in place, not that any
     behaviour is covered. It starts meaning something when the requirements below
     are real and their scenarios are linked to tests.

  ✔  Adoption completed

… 7 more lines
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
  ◆ specgate · check   invoicing

  ✔  Specification   validate --strict
  ✔  Tests           node --test

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

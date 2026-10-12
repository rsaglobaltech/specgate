# From scratch · 1 — Install and set up

**From scratch:** **1 Install** → [2 Specify](scratch-2-specify.md) →
[3 Build](scratch-3-build.md) → [4 Prove](scratch-4-prove.md) →
[5 Every day](scratch-5-every-day.md) · about 5 minutes

**Goal:** a new project with Specgate set up, knowing how to run your tests,
and a gate that passes — before there is a single requirement.

The example is the one the landing page records: court bookings for a tennis
club, in plain Node. Your stack will differ; the commands will not.

| Who | Does what in this phase |
| --- | --- |
| **You** | Create the project the way your stack does, run three commands |
| **Your agent** | Nothing yet |
| **The gate** | Runs once, on an empty specification, to prove the wiring |

## 1. Create the project with your own tools

Specgate writes specifications, not application code. Start the project the
way your stack starts one — `npm init`, Spring Initializr, `cargo new`,
`django-admin startproject`, a monorepo generator — and put it under git:

```bash
mkdir court-bookings && cd court-bookings
git init
npm init -y          # here: a package.json whose test script is `node --test`
```

## 2. Set Specgate up — `specgate init`

```bash
npx @rsaglobaltech/specgate@latest init
```

`init` sees the `package.json`, so it sets Specgate up **in place**, in this
folder, and touches no code. It writes the specification (`spec.md`), the
agent contract (`AGENTS.md`), the traceability matrix and a baseline scenario:

<!-- specgate:out-scratch-init:begin — generated; edit the source, not this block -->
```text
$ specgate init
  ◆ specgate · init

  ℹ  Existing code found (package.json) — adopting this repository in place. Nothing in your code is touched.
  ℹ  To scaffold a separate new project instead: specgate init --new

  Stack detection: package.json ──────────────────────────
    · Project: court-bookings
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
  ▲  This does not certify your code yet — it certifies the skeleton.
     A green `validate` right now means the structure is in place, not that any
     behaviour is covered. It starts meaning something when the requirements below
     are real and their scenarios are linked to tests.

  ✔  Adoption completed

  Next steps ─────────────────────────────────────────────
… 7 more lines
```
<!-- specgate:out-scratch-init:end -->

Two words in that output are written for existing code, because to `init` a
folder with a `package.json` *is* existing code: "adopting", and `REQ-001 —
Existing behaviour is preserved`. On a brand-new project that requirement holds
trivially. Leave it as it is; once the app exists, a test that it starts —
naming `REQ-001` — closes it like any other.

<!-- specgate:note -->
**Did it create a sub-folder instead?** In a folder with no build file at all,
`init` scaffolds a separate project (`<slug>/` with `spec.md`, `docs/`, CI and
container files) from a short wizard. Create your project first, as above, and
run `init` inside it — or use `init --new` on purpose when you want the full
scaffold.
<!-- specgate:endnote -->

## 3. Tell it how to run your tests — once

```bash
specgate config set test_cmd "node --test"
```

<!-- specgate:out-scratch-test-cmd:begin — generated; edit the source, not this block -->
```text
$ specgate config set test_cmd "node --test"
  ✔  test_cmd = node --test
     harness.config.yaml
     `check` and `done` now run it.
```
<!-- specgate:out-scratch-test-cmd:end -->

From now on `check` and `done` run your suite as part of the gate. Use your
stack's own command: `npm test`, `./mvnw -B verify`, `pytest`, `go test ./...`.

## 4. Run the gate

```bash
specgate check
```

<!-- specgate:out-scratch-check:begin — generated; edit the source, not this block -->
```text
$ specgate check
  ◆ specgate · check   court-bookings

  ✔  Specification   validate --strict
  ✔  Tests           node --test

  ✔  Gate passed — the specification and `node --test`
```
<!-- specgate:out-scratch-check:end -->

Green, with an honest warning: there is nothing to certify yet. The warning
goes away in the next phase, when the brief becomes requirements.

## You're done when…

- `specgate check` ends with `✔  Gate passed — the specification and` your test command.
- `spec.md`, `AGENTS.md`, `features/` and `docs/specs/traceability.md` exist and are committed.

```bash
git add -A && git commit -m "Specgate set up"
```

## If something goes wrong

| You see | It means | Do |
| --- | --- | --- |
| `Gate passed — the specification` and *"nothing here runs your tests"* | No test command is configured | `specgate config set test_cmd "<your command>"` |
| A new `<slug>/` folder appeared | There was no build file, so `init` scaffolded | Create the project first, then `init` inside it |
| `command not found: specgate` | Not installed globally | Prefix with `npx @rsaglobaltech/specgate@latest`, or `npm install -g @rsaglobaltech/specgate` |

**Using an agent?** `specgate agents init --tool claude` (or `cursor`,
`copilot`, `gemini`, …) installs the `/specgate:*` commands for it. See
[Agents](../agents.md).

**Next:** have a plan or a client's brief? [Write the brief](write-the-brief.md)
first — then **[phase 2 — from the brief to a checked spec →](scratch-2-specify.md)**

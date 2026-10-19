# Quickstart — you just cloned a spec-driven repo

> 5 minutes. For a developer **joining** a project that already uses Specgate.
> Setting it up yourself? Start a [new project from scratch](start/scratch-1-install.md)
> or [adopt an existing one](start/existing-1-adopt.md) — both are on
> [Getting started](getting-started.md).

## 0. Prerequisites

- **Node.js ≥ 22**.
- Run everything below with `specgate` (installed via `npx @rsaglobaltech/specgate`
  or a global install; the binary is `specgate` either way). All commands auto-detect the project root from your
  current directory — no `--project-dir` needed once you're inside the repo.

```bash
git clone <your-repo> && cd <your-repo>
npm install            # or your project's setup
```

## 1. See where the project stands

```bash
specgate status
```

Lists every requirement and what it still needs — its scenario, its test, its
code, or just closing — and ends with the one command to run next, naming the
requirement. `specgate plan` has the full detail when you want it.

## 2. Read the requirement, then work

Each requirement maps to a Gherkin `.feature` file (the executable spec) and a
row in `docs/specs/traceability.md`, which is generated — nobody edits it. Read
the feature, **write the test first**, then the code until the test passes.

## 3. Name the requirement in its test — that is the link

```java
// REQ-007: a payment over the limit is refused
@Test void refusesPaymentsOverTheLimit() { … }
```

The matrix is generated from `spec.md`, the scenario tags and the tests, so a
test that mentions `REQ-007` is linked — nothing to run, nothing to edit.
`specgate check` regenerates it before the gate. (A project that keeps its
matrix by hand, or a link derivation cannot see, uses
`specgate req link REQ-007 --test … --code …`.)

Adding brand-new behaviour? Open a change:

```bash
specgate propose rounding-rules
```

It writes `docs/specs/changes/rounding-rules/` — a proposal, tasks, and a delta
with the next `REQ` ids reserved for it. Write the requirement and its scenario
in the delta, with real values in place of the `<placeholders>`; the gate
refuses any that are left when you deliver it. While the change is open its
requirements already count: `status` lists them and `apply` delivers them.
(For a single requirement straight into `spec.md`, `specgate new "<title>"`
still works.)

## 4. Deliver it

```bash
specgate apply REQ-007 --test-cmd "npm test"   # refused while no test names it;
                                              # the gate, the suite, then Implemented
```

Without an id, `specgate apply` takes the next requirement `status` names.
Nothing is written while the gate fails. `done` is the old name of `apply`.

When every requirement of your change is `Implemented`, close it:

```bash
specgate archive rounding-rules
```

It merges the delta into the specs and writes the feature files — and refuses
while a requirement is still pending, naming the `specgate apply` to run.

## 5. Check before you push

```bash
specgate check --test-cmd "npm test"
```

`check` is the gate: `validate --strict`, then your tests. Run
`specgate config set test_cmd "npm test"` once and it is just `specgate check`. Without a test command
it still passes — and says it checked the specification, not the code.

Every failure tells you the exact fix. An orphan `.feature` — one no
requirement claims — needs its scenario tagged `@REQ-NNN @SCN-NNN`;
`specgate fix --dry-run` lists anything it can repair on its own.

## Daily loop, in one line

```
specgate propose  →  test that names the REQ  →  specgate apply  →  specgate status  →  specgate archive  →  specgate check
```

That's the whole day-to-day. Reach for the [how-to guide](how-to.md) for
specific recipes, or the [tutorial](tutorial.md) to build a project end-to-end.

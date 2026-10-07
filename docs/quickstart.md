# Quickstart — you just cloned a spec-driven repo

> 5 minutes. For a developer **joining** an existing spec-driven project — not
> scaffolding a new one. For the full build-from-scratch walkthrough see the
> [tutorial](tutorial.md).

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

Adding a brand-new requirement? One command writes it in all three places:

```bash
specgate new "Totals are rounded half-up"
```

It assigns the next `REQ-NNN`, drafts its section in `spec.md`, writes a tagged
scenario of `<placeholders>` under `features/`, and links the row. Rewrite the
placeholders before you close it: while the requirement is `Draft` the gate
leaves them alone, and `specgate done` refuses any that are left.

## 4. Close the loop

```bash
specgate done REQ-007 --test-cmd "npm test"   # the gate, the suite,
                                             # then flips the status
```

## 5. Check before you push

```bash
specgate check --test-cmd "npm test"
```

`check` is the gate: `validate --strict`, then your tests. Put `test_cmd:` in
`harness.config.yaml` and it is just `specgate check`. Without a test command
it still passes — and says it checked the specification, not the code.

Every failure tells you the exact fix. An orphan `.feature` — one no
requirement claims — needs its scenario tagged `@REQ-NNN @SCN-NNN`;
`specgate fix --dry-run` lists anything it can repair on its own.

## Daily loop, in one line

```
specgate status  →  specgate new  →  test that names the REQ  →  specgate done  →  specgate check
```

That's the whole day-to-day. Reach for the [how-to guide](how-to.md) for
specific recipes, or the [tutorial](tutorial.md) to build a project end-to-end.

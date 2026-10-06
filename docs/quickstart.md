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
specgate plan
```

Lists every requirement and what it still needs — a missing `.feature`, a
missing test, production code, or just a status update. Pick one to work on.

## 2. Read the requirement, then work

Each requirement maps to a Gherkin `.feature` file (the executable spec) and a
row in `docs/specs/traceability.md`. Read the feature, **write the test first**,
then the code until the test passes.

```bash
specgate req list          # readable view of the matrix (no raw markdown)
```

## 3. Link your work to the requirement — never edit the matrix by hand

```bash
# Point the requirement at the test and code you just wrote
specgate req link REQ-007 --feature features/billing/pay.feature \
                      --test src/test/PayTest.java \
                      --code src/main/Pay.java
```

Adding a brand-new requirement? One command writes it in all three places:

```bash
specgate new "Totals are rounded half-up"
```

It assigns the next `REQ-NNN`, drafts its section in `spec.md`, writes a tagged
scenario of `<placeholders>` under `features/`, and links the row. Rewrite the
placeholders before you close it: while the requirement is `Draft` the gate
leaves them alone, and `specgate done --strict` refuses any that are left.

## 4. Close the loop

```bash
specgate done REQ-007 --strict --test-cmd "npm test"   # validates, runs the suite,
                                                      # then flips the status
```

## 5. Check before you push

```bash
specgate check --test-cmd "npm test"
```

`check` is the gate: `validate --strict`, then your tests. Put `test_cmd:` in
`harness.config.yaml` and it is just `specgate check`. Without a test command
it still passes — and says it checked the specification, not the code.

Every failure tells you the exact fix. Mechanical problems (an orphan
`.feature`, a requirement in `spec.md` with no row) can be auto-repaired:

```bash
specgate fix --dry-run       # see what it would change
specgate fix                 # apply, then re-run validate
```

## Daily loop, in one line

```
specgate plan  →  work (test first)  →  specgate req link  →  specgate done  →  specgate check
```

That's the whole day-to-day. Reach for the [how-to guide](how-to.md) for
specific recipes, or the [tutorial](tutorial.md) to build a project end-to-end.

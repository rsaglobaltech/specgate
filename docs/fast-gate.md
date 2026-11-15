# A faster gate

The gate costs what your test suite costs, and the suite grows with every
requirement — while `apply` runs the gate once per requirement. This page is
the three ways `specgate check` costs less: running only what the change
touches, not running again what passed on the same code, and running the
architecture check beside the tests.

**You need:** a project in git where `specgate check` already passes
([Validating](validating.md)).

## Run only what the change touches

`check --affected` runs the tests of what changed since the base
branch — `--base <ref>`, else `SPECGATE_BASE`, else origin's default branch,
`main`, `master` or `develop` — counting uncommitted and untracked files:

```bash
specgate config set test_cmd_affected "npx vitest run {files}"
specgate check --affected
```

- A requirement is **touched** when a changed line of a spec falls in its
  section or names it, when its feature file changed, or when a code or test
  file the matrix links to it changed.
- The tests that run are the ones the matrix links to the touched
  requirements, every changed test, and — in JavaScript and TypeScript — the
  tests whose relative imports reach a changed file.
- They go to the test command as `{files}`, each quoted for your shell;
  `{req}` is the requirement, when exactly one is touched.
  `test_cmd_affected:` is the command `--affected` and `apply` use, so
  `test_cmd` stays the whole suite. A command with neither placeholder runs
  whole, and the finding `affected_needs_files` says how to add `{files}`.

## When it runs everything

It runs the **whole suite** instead, and says why under `selection.reason`,
whenever it cannot say what the change needs:

- `package.json`, a lockfile, `harness.config.yaml`, a `tsconfig`, a build or
  runner configuration (`pom.xml`, `build.gradle`, `pyproject.toml`, `go.mod`,
  `jest.config.js`, …), or a file matching a glob under `full_on:` changed;
- a changed or removed file is linked to nothing — no requirement, test or
  import;
- nothing changed, no base branch was found, or what changed has no test.

## A test that passed is not run again

A test file that passed under `--affected` is not run again while its content,
the files its imports reach, the code the matrix links to its requirements,
the test command and the lockfiles are unchanged; the answer lists it under
`selection.cached`. A test that is not JavaScript or TypeScript, whose imports
cannot all be followed, or that reaches the file system, a process or the
network is re-run on any change to the project's source. The record is kept
in the git folder, beside the last gate result. `--no-cache` runs everything
selected; a failing run forgets what it ran.

## Where the whole suite still runs

`check` with no flag runs the whole suite, as before, and `check --ci` always
does — with `--affected` too, which it ignores (`affected_ignored_ci`) — and
never uses the cache. `apply` fills `{files}` with the test files of the
requirement it delivers.

A test that reaches code by starting a process or a browser is selected by
the matrix, through its requirement — not by its imports. Name the
requirement in it, and `--affected` finds it.

## The architecture check beside the tests

After `validate --strict`, which runs alone because it fails fast, `arch_cmd`
and the tests run at the same time, each with its own output; both are
reported before the gate decides. When both build into the same folder — two
Maven runs on `target/`, say — run them one after the other:

```bash
specgate config set gate_parallel false
```

## What it says

Every `check --json` answer has `selection`: `mode` (`affected` or `full`),
`reason`, `base`, `changed`, `requirements`, `tests`, `cached` and the
`command` that ran. Each entry of `stages` has `ms`, the time it took (`null`
when it did not run), and on a terminal each stage's line shows its time.
`specgate check --last --json` gives both back.

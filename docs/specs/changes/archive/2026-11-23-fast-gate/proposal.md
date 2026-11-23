# Proposal: fast-gate

## Intent

The gate costs what the project's test suite costs, and it runs the whole
suite every time. Measured on specgate-studio (about 66 requirements),
`specgate check` takes about 77 s: `validate --strict` 1.2 s, `arch_cmd` 2.5 s
and `npm test` — build, unit, Playwright and performance tests — about 73 s.
specgate's own share is small; the suite is what grows. `apply` runs the gate
once per requirement, so building N requirements costs N runs of a suite that
grows with N: quadratic.

`apply` already fills `{req}` in `test_cmd` (REQ-183); `check` runs
everything, always. And specgate's own commands were not linear either:
`validate --strict` on a generated project of 1,000 requirements took 10 s,
because linking by mention scanned every test and source file once per
requirement and the template-obligation check re-read the whole spec once per
requirement.

## Scope

In scope:

- REQ-510: `check --affected [--base <ref>]` — the requirements a change
  touches, from the git diff and the matrix (per scenario, REQ-498), and the
  test files to run: those the matrix links to them, the changed tests, and
  in JavaScript and TypeScript the tests whose relative imports reach a
  changed file. `selection` in every `check --json` answer.
- REQ-511: a change to a file every test depends on — package.json, a
  lockfile, harness.config.yaml, a tsconfig, a build or runner configuration,
  or a glob under `full_on:` — runs the whole suite and names the file.
- REQ-512: nothing maps, nothing changed, no base, a file linked to nothing:
  the whole suite, and the reason. Never no test, silently.
- REQ-513: `{files}` in the test command, each file quoted for the platform's
  shell; `{req}` when one requirement is touched; `test_cmd_affected:` so
  `test_cmd` can stay the whole suite; a command with no placeholder runs whole
  and says how to add `{files}`.
- REQ-514: `check` with no flag runs the whole suite, as before; `--ci` always
  does, and never uses the cache.
- REQ-515: `apply` fills `{files}` with the requirement's own test files.
- REQ-516: a result cache in the git folder, beside `last-check.json`: a test
  file that passed on the same content, the same dependencies, the same
  command and the same lockfiles is not run again. `--no-cache`.
- REQ-517: a scaling benchmark on generated projects of 500, 1,000 and 2,000
  requirements, and the quadratic hot spots it found, fixed.
- REQ-518: `arch_cmd` and the tests run side by side after `validate`;
  `gate_parallel: false` runs them one after the other.
- REQ-519: `ms` on every stage of `check --json` and of the last result.

Out of scope:

- `--affected` as the local default. `check` keeps running the whole suite:
  the speed is opt-in until it has been measured on projects other than ours.
  A `harness.config.yaml` key making `--affected` the local default (never in
  CI) is the natural next step once it has.
- Import scans for languages other than JavaScript and TypeScript: their
  changed files select by the matrix only, and a file no requirement links
  runs the whole suite.
- Caching a whole-suite run: only files run through `{files}` are known to
  have passed one by one.

## Approach

The selection is pure — `packages/core/src/domain/AffectedTests.ts` — over
what the caller reads: the changed files and lines (`git diff -z -U0` against
the merge base, plus untracked files), the matrix's scenario rows, the
project's test files and, for JavaScript and TypeScript, a static scan of
relative imports (`ImportScan.ts`). A file is classified once: global (whole
suite), spec text (the requirement sections its changed lines fall in, and the
ids they name), feature (its tags), test (run it), inert documentation
(ignored), or code (its requirements and the tests that import it — linked to
nothing, the whole suite). The cache keys each test file by the hash of its
content and of its dependencies, under a key made of the command, the
lockfiles, the global files and the Node version; a failing run forgets the
files it ran. The tests write their output to a file, not a pipe, so
`arch_cmd` can run at the same time without either blocking on the other.

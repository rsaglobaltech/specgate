# The gate on your machine

Run the gate before you push, and a red pull request becomes rare. At the end
of this page `specgate check` runs your tests, you know how to run only what a
change touches, and a git hook runs it for you.

## Tell it your tests

`init` and `adopt` save the test command they find (`npm test`, `mvn test`,
`gradle test`…) as `test_cmd:` in `harness.config.yaml`. Set or change it, and
your architecture check if you have one:

```bash
specgate config set test_cmd "npm test"
specgate config set arch_cmd "npx depcruise src"
```

`--test-cmd` overrides it for one run:

```bash
specgate check --test-cmd "npm run test:unit"
```

## Run it

```bash
specgate check
```

It prints one line per stage and, when it fails, the finding with its fix.
The architecture check and the tests run side by side;
`specgate config set gate_parallel false` runs them one after the other.

Compare the requirement ids with the branch you will merge into, as CI does:

```bash
specgate check --base origin/main
```

Without `--base`, it uses `SPECGATE_BASE`, then `pr.base` in
`alm.config.yaml`, then origin's default branch. Two branches that each add a
`REQ-012` with a different title fail here, before the merge, with the next
id free on both sides.

Against the base, the gate also names what the branch changes in the
controls — the guard, `.specgate/gate.yaml`, a change's approvals, evidence, a
sealed acceptance test — as `controls_changed_on_branch`. It is a warning by
default (rule `controls`): it is said for the person who reviews the pull
request. [Read a failure](failures.md#what-a-person-approved) has the fix.

## Only what the change touches

On a large project the whole suite is slow. `--affected` runs the tests the
change can break and skips the ones that passed on the same code:

```bash
specgate check --affected
```

What it selects, and when it runs everything anyway: [A faster gate](../fast-gate.md).
CI always runs the whole suite.

## Read the last result

Each run is kept in the repository's git folder. Read it back without running
anything:

```bash
specgate check --last
```

```text
  ◆ specgate · check --last   shop

  ▲  The last gate failed.
     2026-11-18T12:30:32.026Z · bdd95406e212 on main with uncommitted changes

  ids                       skipped
  changes                   skipped
  validate                  failed
  architecture              skipped
  tests                     not run
```

`--json` gives each stage with its command, result, time and findings — what
an editor or a script reads.

## Before each commit

A hook stops a requirement without a scenario or a test before the commit
leaves your machine. The plain-git hook, and the same with husky, are in
[Automation](../automation.md#run-the-gate-in-a-pre-commit-hook). They run
`validate . --strict`, which skips your tests: keep it so if your tests are
slow, and let CI run them. Anyone can skip a hook with
`git commit --no-verify`, so CI runs the gate too.

## Without Node

The Docker image runs the same gate with nothing installed but Docker:

```bash
docker run --rm -v "$PWD:/workspace" \
  ghcr.io/rsaglobaltech/specgate:1.6.0 validate . --strict
```

The Maven and Gradle plugins bind it to `mvn verify`:
[Run the gate without Node](../automation.md#run-the-gate-without-node).

## Next

- [In CI](ci.md)

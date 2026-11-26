# The gate

The gate is what stands between a change and your main branch. It proves
that every requirement the change delivers is specified, has a scenario that
can fail, is linked to a test that names it, and that the tests pass. At the
end of this guide your project runs the gate on your machine and in CI, as a
check a pull request cannot merge without, and you can read any failure it
reports.

**You need:** a project where `specgate init` or `specgate adopt` has run, and
git.

| Page | What you do there |
| --- | --- |
| [On your machine](local.md) | Run the gate before you push; only what changed; a pre-commit hook |
| [In CI](ci.md) | The job `ci init` writes, for GitHub, GitLab, Azure or Jenkins, made a required check |
| [Adopt it without a red build](baselines.md) | Today's findings recorded as debt, so only new ones fail |
| [Read a failure](failures.md) | Every code the gate fails with, what it means and what to do |

## What it runs

`specgate check` runs the stages in this order. A stage that fails stops the
ones after it, except the architecture check and the tests, which run side
by side.

<!-- specgate:diagram gate-stages -->

| Stage | What it proves | Fails with |
| --- | --- | --- |
| Ids | No requirement id here means something else on the base branch; with `--base`, what the branch changes in the controls is named for the reviewer | `id_taken_on_base`, `controls_changed_on_branch` |
| Changes | Every open change's delta validates; what a person approved — requirements, design, sealed acceptance tests — is as it was approved | `check_change_invalid`, `approved_requirement_changed`, `file_outside_design`, `acceptance_not_sealed` |
| Specification | `validate --strict`: specs, scenarios, links, coverage of the matrix | `check_validate_failed` |
| Architecture | Your `arch_cmd` (ArchUnit, dependency-cruiser…) passes | `check_arch_failed` |
| Tests | Your `test_cmd` passes | `check_tests_failed` |
| Scenarios | With `bdd: required` in the policy: the scenarios of every delivered requirement pass with `bdd_cmd`. `--no-scenarios` skips them | `check_scenarios_failed` |
| Acceptance | Where an open change sealed acceptance tests: they pass with `acceptance_cmd` | `acceptance_red`, `acceptance_no_command` |
| Quality | The `checks:` of `harness.config.yaml` — coverage, mutation, secrets… | `check_quality_failed` |

A stage with nothing to run is said, not failed: without a `test_cmd` the gate
checks the specification only and says so, and without a base branch the ids
are not compared.

```text
$ specgate check
  ◆ specgate · check   shop

  ·  Ids            not compared with a base — no base branch (pass --base <branch>)
  ✔  Specification   validate --strict
  ✔  Tests           npm test
  ·  Architecture    not checked — specgate config set arch_cmd "<command>"

  ✔  Gate passed — the specification and `npm test`
```

Exit codes: `0` the gate passed, `1` it failed, `2` the command was used
wrong. A pipeline needs nothing else.

## Which command

| Command | Use it for |
| --- | --- |
| `specgate check` | The gate. Before you push, and in CI. |
| `specgate check --ci` | The same, in CI: a quality check that cannot run fails instead of being skipped, and the `ci`-stage checks run too. |
| `specgate validate . --strict` | The specification alone, without running your tests — the Docker image and the Maven and Gradle plugins run this. |
| `specgate quality run` | The quality checks alone, by stage. |
| `specgate check --last` | The last result, without running anything. |

## What a requirement owes, by status

The gate does not ask a requirement for everything at once:

- **Draft** owes nothing yet. A new project's gate is green on day one, and a
  scenario may still hold `<placeholders>`.
- **Approved** and later owe a scenario that can fail: real steps, `Given`,
  `When` and `Then` capitalised.
- **Implemented**, **Verified** and **Released** owe a test that names the
  requirement or its scenario, a real obligation in `spec.md` instead of the
  sentence Specgate wrote, and files that exist for every path the matrix
  names.

The details of each rule: [What `validate` checks](../validating.md#what-validate-checks).

## Next

- [On your machine](local.md)

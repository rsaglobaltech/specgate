# Read a gate failure

Every failure the gate reports says where, what, its code in brackets, and
the fix on the next line. At the end of this page you can read any of them
and know what to change — in the code, the test, the scenario or `spec.md`.

## The shape of a failure

```text
  ✖  Specification   validate --strict

     ◆ specgate · validate   shop

       ✖  --strict-scenarios violations detected: 4 (4 that make a scenario pass without testing anything)
         ✖  features/a-customer-can-place-an-order.feature:5  `given` is not a Gherkin keyword; write `Given`. Cucumber reads it as prose, so the line does nothing.  [keyword_case_invalid]
          fix: Write `Given`.
         ✖  features/a-customer-can-place-an-order.feature:4  scenario_has_no_steps — Cucumber sees no steps here, so this scenario passes without testing anything. If the steps look like they are there, check their keywords: Gherkin is case-sensitive.  [scenario_has_no_steps]
          fix: Write Given / When / Then steps, in that capitalisation.

  ✖  The gate failed: validate --strict.  [check_validate_failed]
     fix: Fix what validate reports above, then run `specgate check` again.
```

Read it from the bottom: the last line names the stage that failed
(`check_validate_failed`); above it, each finding with its file and line. The
stages after a failed one did not run — `specgate check --last` lists each as
`not run`. In CI the same text is in the job's log; `--json` gives it as data,
each finding with `code`, `file`, `line` and `fix`.

## The stage that failed

| Code | The stage | What to do |
| --- | --- | --- |
| `id_taken_on_base` | A requirement id here has another title on the base branch: two branches added the same `REQ-NNN` | Renumber yours to the id the fix names, the next free on both sides |
| `check_change_invalid` | An open change's delta does not validate | `specgate change validate <id>` lists every finding |
| `check_validate_failed` | The specification: one of the findings below | Fix the findings above it |
| `check_arch_failed` | Your `arch_cmd` failed | Move the code where the architecture expects it, or change the rule on purpose |
| `check_tests_failed` | Your `test_cmd` failed; its output is above | Make the tests pass |
| `check_scenarios_failed` | With `bdd: required`, a delivered requirement's scenarios failed with `bdd_cmd` | Make the code do what the failing scenarios say; `specgate scenarios <REQ>` runs one requirement's, scenario by scenario |
| `acceptance_red` | The acceptance tests a person approved did not pass with `acceptance_cmd`; the last lines of its output are above | Make the code do what the approved tests say: the tests are the contract, not the thing to change |
| `acceptance_no_command` | Acceptance tests are sealed and the project names no command that runs them | `specgate config set acceptance_cmd "<command>"`, `{files}` the sealed paths: `npx playwright test {files}`, `pytest {files}` |
| `check_quality_failed` | A quality check found something new, or could not run under `--ci` | Each check's own finding is above it: `quality_check_failed` |
| `baseline_incomplete` | `check --baseline` was asked to record what a baseline cannot hold | Fix what validate reports, then record again — [Adopt it without a red build](baselines.md) |
| `gate_policy_invalid` | `.specgate/gate.yaml` names a preset, rule, level or date it cannot read | Use what the fix lists — [Configure the gate](policy.md) |

## What a person approved

These say that something a person approved is no longer what they approved.
The fix is never to edit the record by hand: restore what changed, or have a
person approve the new version.

| Code | Means | What to do |
| --- | --- | --- |
| `approved_requirement_changed` | A requirement of an approved change is not what was approved | Put it back, or have a person approve it again: `specgate change approve <id>` |
| `approval_not_sealed` | A warning: the change was approved before approvals sealed its requirements, so a change to one would go unseen | `specgate change approve <id>` seals it |
| `file_outside_design` | A new source file that the approved design of the change does not name (rule `scope`) | Name it in the change's `design.md` and have the design approved again, or open a change for it: `specgate propose <change-id>` |
| `acceptance_not_sealed` | An acceptance test a person approved has changed or is gone (rule `acceptance`) | `git checkout -- <file>`, or a person approves the new version: `specgate change approve <id> --layer acceptance` |
| `controls_changed_on_branch` | `check --base`: the branch changes the controls — the guard, `.specgate/gate.yaml`, a change's approvals, evidence, a sealed acceptance test. A warning by default (rule `controls`) | The reviewer reads it as part of the pull request. Make `.specgate/` and `docs/specs/changes/*/approvals.json` code-owned so that review is required |

## Refused before the gate

`apply` and `change approve` refuse these before anything is recorded:

| Code | Means | What to do |
| --- | --- | --- |
| `change_not_approved` | `apply`: the requirement's change is not approved yet; a requirement is delivered once a person approved its change | A person runs `specgate change approve <id>`, with the `--layer` the message names — or `approvals: { required: never }` in `harness.config.yaml` |
| `steps_changed_after_code` | `apply`: step definitions were added or changed after the requirement's code began; steps written to agree with the code prove nothing | A person reads the steps against the scenarios, then runs in a terminal `specgate apply <REQ> --steps-reviewed` — or put the steps back and make the code pass them |
| `approve_needs_person` | `change approve` was run where there is no terminal — by an agent or a script. Nothing was recorded | A person runs `specgate change approve <id>` in a terminal, or approves it in the studio's Review |

Not failures, said so you know what was not checked: `ids_not_compared` (no
base branch to compare with), `check_not_run` (a check skipped, with why),
`gate_rule_reported` (findings the policy reports instead of failing).

## The specification's findings

### A scenario that cannot fail

| Code | Means | Fix |
| --- | --- | --- |
| `keyword_case_invalid` | `given`, `when`, `then` in lower case: Cucumber reads the line as prose | Capitalise the keyword |
| `scenario_has_no_steps` | Cucumber sees no steps, so the scenario passes without testing anything | Write `Given` / `When` / `Then` steps |
| `scenario_placeholder_step` | A step still holds `<the action under test>` — allowed in Draft only | Write the real state, action and outcome |

### A delivered requirement without its proof

From the moment a requirement is Implemented, Verified or Released:

| Code | Means | Fix |
| --- | --- | --- |
| `strict_tdd_1` | No test names the requirement (`TDD-1`) | Write a test whose name or body says `REQ-NNN` or one of its `SCN-NNN` — that mention is the link. Or move it back to Draft. |
| `strict_tdd_2` | Its row has no scenario id (`TDD-2`) | Tag the scenario with `@REQ-NNN @SCN-NNN` |
| `strict_tdd_3` | It is in `spec.md` and not in the matrix (`TDD-3`) | Give it a `## REQ-NNN` section and a tagged scenario; `specgate new` writes both |
| `scenario_not_covered` | A scenario of a declared feature file is named by no test | Name it in a test, or delete the scenario if it no longer describes behaviour |
| `link_without_evidence` | The test artifact names neither the requirement nor its scenarios | Name the requirement in the test: a path that exists proves nothing |
| `requirement_template_obligation` | The obligation in `spec.md` is still "The system MUST satisfy: …" | Write what must hold, when, and how it is observed |

### Links that point nowhere

| Code | Means | Fix |
| --- | --- | --- |
| `declared_artifact_missing` | A path the matrix declares does not exist | Fix the path, or restore the file |
| `feature_not_in_matrix` | A feature file no requirement claims | Tag its scenario `@REQ-NNN @SCN-NNN`, or `specgate new` |
| `scenario_id_not_in_feature` | The matrix points at a scenario id the feature file does not carry | Put `@SCN-NNN` above its `Scenario:` line |
| `matrix_stale` | The matrix no longer matches `spec.md`, the tags and the tests | `specgate check` regenerates it: commit the result |

### Pack drift

`validate --against-lock` fails when a file a domain pack rendered no longer
matches the digest pinned in `.specops.lock` — a moved tag, a rewritten
history, a hand-edited generated file. See [Supply chain](../supply-chain.md).

## Green here, red in CI

| Why | What to do |
| --- | --- |
| CI compares the ids with the base branch and your run did not | `specgate check --base origin/main` locally |
| CI runs the whole suite, `--affected` ran part of it | `specgate check` without `--affected` |
| A quality check skipped here (no Docker) must run in CI | Start Docker and run `specgate check --ci` |
| A shallow clone: the base branch is not there | `fetch-depth: 0` (GitHub), `GIT_DEPTH: 0` (GitLab) |
| Windows or macOS only: a path or a line ending | The GitHub job runs all three for this reason; `.gitattributes` keeps line endings stable |
| CI runs another version of Specgate | The version is pinned in the CI file: [Pin the version](ci.md#pin-the-version-and-move-it-on-purpose) |

The quality checks' own failures — `no report at …`, a finding the same on
every change, SonarQube's login — are in
[Quality: When it goes wrong](../quality.md#when-it-goes-wrong). Anything
else: [Troubleshooting](../troubleshooting.md).

## Next

- [Validating](../validating.md) — every rule `validate --strict` applies, in detail
- [Quality checks](../quality.md) — coverage, mutation and security in the gate

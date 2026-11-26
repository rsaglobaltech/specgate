# Configure the gate

Not every team wants every rule to fail a pull request on day one. At the end
of this page your repository says what its gate requires — rule by rule,
fail, report or skip — and the gate applies it the same on a laptop and in
every CI, with a date from which the errors count.

**You need:** the gate running ([The gate](index.md)).

## The policy file

`.specgate/gate.yaml`, committed with the code. `specgate init` and
`specgate adopt` write it with the `standard` preset:

```yaml
preset: standard
rules:
  tdd: error
  scenarios: error
  requirements: error
  links: error
  coverage: warning
  ids: error
  quality: error
  use_cases: warning
  state_machines: error
  scope: warning
  controls: warning
  acceptance: error
# enforce_from: 2026-12-31
# bdd: required
```

Each rule is one of three levels:

| Level | The gate |
| --- | --- |
| `error` | fails on the rule's findings |
| `warning` | reports them, with `gate_rule_reported`, and passes |
| `off` | does not run the rule |

**No file is the `strict` preset**, which is what `validate --strict` always
meant: every rule `error` except `use_cases` and `controls`, which are
warnings in `strict` too. A project that never writes a policy keeps the gate
it had.

## The rules

| Rule | Fails on | Flag |
| --- | --- | --- |
| `tdd` | A delivered requirement with no test that names it | `--strict-tdd` |
| `scenarios` | A scenario that cannot fail: placeholders, lower-case keywords, no steps | `--strict-scenarios` |
| `requirements` | A requirement with no obligation, or still the sentence Specgate wrote | `--strict-requirements` |
| `links` | A path the matrix declares that does not exist | `--strict-links` |
| `coverage` | A scenario of a declared feature file that no test names | `--strict-coverage` |
| `ids` | A requirement id that means something else on the base branch | — |
| `quality` | The quality checks of `harness.config.yaml` | — |
| `use_cases` | A requirement that names no use case of `docs/specs/use-cases.md`, or a use case nothing delivers | `--strict-use-cases` |
| `state_machines` | A state machine of `docs/specs/state-machines/` with no start, a state or requirement that does not exist, or a forbidden transition | — |
| `scope` | A new source file that the design of an approved change does not name, where a design names files | — |
| `controls` | What the branch changes in the controls — the guard, the gate's policy, approvals, evidence — named for the person who reviews it (`check --base`) | — |
| `acceptance` | An acceptance test a person approved that is not as it was approved, or does not pass with `acceptance_cmd` | — |

An individual flag always fails on its rule, whatever the policy says: a CI
file that runs `validate --strict-tdd` keeps meaning what it meant.

## The presets

| Rule | `minimal` | `standard` | `strict` |
| --- | --- | --- | --- |
| `tdd` | error | error | error |
| `scenarios` | error | error | error |
| `requirements` | warning | error | error |
| `links` | error | error | error |
| `coverage` | off | warning | error |
| `ids` | warning | error | error |
| `quality` | warning | error | error |
| `use_cases` | off | warning | warning |
| `state_machines` | warning | error | error |
| `scope` | warning | warning | error |
| `controls` | warning | warning | warning |
| `acceptance` | warning | error | error |

`minimal` fails on what leaves a requirement unproven and reports the rest:
a team adopting the gate. `standard` reports coverage, which is a name match
rather than a run of the suite, and new files outside the design (`scope`).
`use_cases` stays a warning until a project's catalog is written. `controls`
is a warning in every preset: who approved cannot be told from a branch, so
the gate names the change for the reviewer. `state_machines`, `scope` and
`acceptance` say nothing in a project with no state machines, no approved
design that names files, or no sealed acceptance tests. `rules:` overrides any
rule of the preset.

**Changing `preset:` alone relaxes nothing that `init` wrote.** `specgate init`
writes every rule out in full under `rules:`, and a rule written there wins
over the preset. To move to `minimal`, delete the `rules:` lines you want the
preset to decide, or set each rule to the level you want.

## The other keys

| Key | What it does |
| --- | --- |
| `preset` | `minimal`, `standard` or `strict`; `strict` when it is missing |
| `rules` | One level per rule, over the preset's |
| `enforce_from` | A date, `YYYY-MM-DD`: until then every `error` is a warning (below) |
| `bdd: required` | The scenarios are executable: the gate runs them with `bdd_cmd` of `harness.config.yaml` (the Scenarios stage). `specgate init` writes it when the project has a runner for its feature files; otherwise `specgate migrate bdd` |
| `trust` | Each module's trust level, 1 to 5, for the harness: `trust: { payments: 2, catalog: 4 }`. Each key must be a capability under `docs/specs/capabilities/`; any other fails the gate (`payments is not a capability of this project`). `specgate trust` shows what each module has earned. A project with no `trust:` is untouched |

Any other key fails the gate: on the terminal `check` names the key
(`` `foo` is not a key of the gate policy ``) and fails with
`check_validate_failed`; with `--json`, the finding is `gate_policy_invalid`.

## Tighten it on a date

```yaml
preset: strict
enforce_from: 2026-12-15
```

Until that date every `error` is reported as a warning, and the gate says
until when. On the date, the errors fail it. The team sees exactly what will
fail, for as long as it needs to fix it, and nobody has to remember to edit
the CI file.

## Change it without opening the file

```bash
specgate config set gate.preset minimal
specgate config set gate.rules.coverage off
specgate config set gate.enforce_from 2026-12-15
```

A value the policy could not read is refused before the file is written,
with `config_value_invalid` and the values to use. `specgate config keys`
lists the keys.

## What the gate says

`check` names the policy in force and what it relaxes, under its header:

```text
  ·  Policy         .specgate/gate.yaml (strict): tdd warning
  ✔  Specification   validate --strict
  ▲  1 tdd finding(s) reported, not failed: .specgate/gate.yaml sets tdd to warning.
```

With `--json`, the reported findings are in `status` as warnings, each with
its own code, plus one `gate_rule_reported` per rule. A policy that cannot be
read fails the gate with `gate_policy_invalid` and every problem in it.

## Next

- [Read a failure](failures.md)
- [In CI](ci.md)

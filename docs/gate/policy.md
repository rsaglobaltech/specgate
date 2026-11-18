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
# enforce_from: 2026-12-31
```

Each rule is one of three levels:

| Level | The gate |
| --- | --- |
| `error` | fails on the rule's findings |
| `warning` | reports them, with `gate_rule_reported`, and passes |
| `off` | does not run the rule |

**No file is the strict gate**: every rule `error`, which is what
`validate --strict` always meant. A project that never writes a policy keeps
the gate it had.

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

`minimal` fails on what leaves a requirement unproven and reports the rest:
a team adopting the gate. `standard` reports coverage, which is a name match
rather than a run of the suite. `rules:` overrides any rule of the preset.

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

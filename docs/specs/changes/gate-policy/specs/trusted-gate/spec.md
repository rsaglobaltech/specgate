# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-604 — The gate's policy is a file of the repository

The system SHALL read what the gate requires from `.specgate/gate.yaml`: a `preset` among `minimal`, `standard` and `strict`, and under `rules:` any of the rules `tdd`, `scenarios`, `requirements`, `links`, `coverage`, `ids` and `quality` set to `error`, `warning` or `off`, overriding the preset; SHALL treat a project without the file as `strict`, every rule `error`; and SHALL, when the file names an unknown preset, rule, level or key, or an `enforce_from` that is not a date, fail `validate --strict` with `gate_policy_invalid` naming every problem with its fix.

#### Scenario: SCN-604a — A preset and an override

- GIVEN a project whose `.specgate/gate.yaml` says `preset: standard` and `rules: { links: off }`
- WHEN the policy is read
- THEN coverage is `warning`, links is `off`, and every other rule is `error`

#### Scenario: SCN-604b — A policy that cannot be read

- GIVEN a `.specgate/gate.yaml` saying `preset: lax` and a rule `speed: error`
- WHEN the developer runs `specgate validate . --strict`
- THEN it exits 1 with `gate_policy_invalid`, naming `lax` and `speed` and the presets and rules to use

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-604.feature kind=functional status=Approved -->

### Requirement: REQ-605 — The gate fails, reports or skips each rule as the policy says

The system SHALL, under `validate --strict` and `check`, report the findings of a rule set to `warning` as warnings with one `gate_rule_reported` naming the rule, and pass; SHALL not run a rule set to `off`; SHALL fail on a rule its own `--strict-<rule>` flag asks for, whatever the policy says; SHALL, while today is before the policy's `enforce_from`, report every `error` rule's findings as warnings, saying the date; SHALL judge the `ids` and `quality` stages of `check` the same way; and SHALL print, under `check`'s header, the policy in force and the rules it relaxes.

#### Scenario: SCN-605a — Tdd reported, not failed

- GIVEN a project where REQ-003 is Implemented with no test naming it, and `.specgate/gate.yaml` sets `tdd: warning`
- WHEN the developer runs `specgate check`
- THEN it exits 0, prints `Policy` with `tdd warning`, and its `--json` status carries `gate_rule_reported` and its validate stage `strict_tdd_1`, both as warnings

#### Scenario: SCN-605b — The flag still fails, and the date relaxes

- GIVEN the same project
- WHEN the developer runs `specgate validate . --strict --strict-tdd`, then sets the policy to `preset: strict` with `enforce_from: 2099-01-01` and runs `specgate validate . --strict`
- THEN the first exits 1 and the second exits 0, saying errors are enforced from 2099-01-01

#### Scenario: SCN-605c — No policy, the gate as it was

- GIVEN the same project with no `.specgate/gate.yaml`
- WHEN the developer runs `specgate check`
- THEN it exits 1 with `check_validate_failed`, and prints no `Policy` line

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-605.feature kind=functional status=Approved -->

### Requirement: REQ-606 — The policy is configured, and a new project starts standard

The system SHALL accept `specgate config set gate.preset <preset>`, `gate.rules.<rule> <level>` and `gate.enforce_from <date>`, writing `.specgate/gate.yaml` and refusing with `config_value_invalid` a value the policy could not read; SHALL list those keys in `specgate config keys`; and SHALL, on `specgate init` and `specgate adopt`, write `.specgate/gate.yaml` with the `standard` preset and every rule on its own line when the project has none, `--no-ci` included, and never touch one that exists.

#### Scenario: SCN-606a — Set through config

- GIVEN a project with no policy
- WHEN the developer runs `specgate config set gate.rules.coverage off`, then `specgate config set gate.preset loose`
- THEN `.specgate/gate.yaml` holds `coverage: off`, and the second exits 2 with `config_value_invalid` naming minimal, standard and strict

#### Scenario: SCN-606b — A new project's policy

- GIVEN an empty folder
- WHEN the developer runs `specgate init --no-ci`
- THEN `.specgate/gate.yaml` says `preset: standard` and lists the seven rules

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-606.feature kind=functional status=Approved -->

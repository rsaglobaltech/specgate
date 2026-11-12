# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-505 — config says the file each setting is kept in

The system SHALL answer `specgate config get`, `config set` and `config list` with `--json` with `files` beside `config`: for each key in the answer, the file it is kept in, relative to the project with forward slashes — `.specgate/config.json`, `harness.config.yaml`, `.harness/profiles.yaml` or `alm.config.yaml`.

#### Scenario: SCN-505a — test_cmd and pet

- GIVEN a project where `specgate config set test_cmd "npm test"` and `specgate config set pet off` have run
- WHEN a tool runs `specgate config list --json` and `specgate config get pet --json`
- THEN the list has `files.test_cmd` `harness.config.yaml` and `files.pet` `.specgate/config.json`, and the get has `files.pet` `.specgate/config.json`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-506 — A catalog of every setting

The system SHALL list with `specgate config keys --json` every key `config set` accepts, each with its `key`, `description`, allowed `values` or null, the `pattern` its value must match or null, its `default` or null, its `current` value in the project or null, and its `file`; a key with a name inside it — a profile's or a check's — SHALL be listed once with `<name>` in its place and once more for each name the project already has.

#### Scenario: SCN-506a — The catalog of a project with one profile

- GIVEN a project with `test_cmd: npm test` and the profile `fast` in `.harness/profiles.yaml`
- WHEN a tool runs `specgate config keys --json`
- THEN `test_cmd` has `current` `npm test` and `file` `harness.config.yaml`, `pet` has `values` `on` and `off` and `default` `on`, and both `profiles.<name>.agent` and `profiles.fast.agent` are listed with the file `.harness/profiles.yaml`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-507 — config set writes agent profiles

The system SHALL accept `specgate config set profiles.<name>.<field> <value>` for the fields `agent`, `advisory`, `cost_per_run_hint`, `price_per_input_token`, `price_per_output_token`, `price_per_cache_read_token` and `price_per_cache_write_token`, writing them to the profile in `.harness/profiles.yaml` — creating the file or the profile when missing and keeping every other line — and `agent_profile`, the profile `harness run` uses by default, in `harness.config.yaml`; and SHALL refuse with `config_value_invalid` and a fix an agent without `{prompt_file}`, an `advisory` that is not `true` or `false`, a cost or price that is not a number of zero or more, a profile name that is not letters, digits, `-` and `_`, and an `agent_profile` that names no declared profile.

#### Scenario: SCN-507a — A profile written, then a bad price refused

- GIVEN a project with no `.harness/profiles.yaml`
- WHEN a tool runs `specgate config set profiles.fast.agent "claude -p < {prompt_file}"` and `specgate config set profiles.fast.price_per_input_token 0.000003`, then `specgate config set profiles.fast.price_per_output_token cheap --json`
- THEN `.harness/profiles.yaml` declares `fast` with that agent and price, which `harness run --profile fast` reads; the last exits 2 with `config_value_invalid` and a fix, and the file is unchanged

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-508 — config set writes quality checks and ALM settings, never a credential

The system SHALL accept `specgate config set` for `quality`, `diff_coverage` and `mutation_score` and for `checks.<name>.<field>` — a check's `run`, `when`, `gate`, `runner`, `image`, `timeout`, `sarif`, `report`, `scope`, `env`, `profile`, `needs`, `network`, `shell` and `docker` — in `harness.config.yaml`, a check created by setting its `run`; and for `alm.<key>` and `alm.pr.<key>` in `alm.config.yaml`, created with `alm_version: 1` when missing; each value checked as the file's reader checks it and refused with `config_value_invalid` and a fix, leaving the file as it was. A key ending in `_env` SHALL take only the name of an environment variable — capitals, digits and `_` — and no key SHALL store a token or password.

#### Scenario: SCN-508a — A check, the Jira settings and a token refused

- GIVEN a project with `harness.config.yaml`
- WHEN a tool runs `specgate config set checks.lint.run "npm run lint"`, `config set checks.lint.when end`, `config set alm.provider jira` and `config set alm.token_env JIRA_TOKEN`, then `config set alm.token_env "ATATT3xFfGF0abc=123" --json` and `config set checks.lint.when later --json`
- THEN `specgate quality list --json` shows the check `lint` at `end`, `alm.config.yaml` has `provider: jira` and `token_env: JIRA_TOKEN`, and the last two exit 2 with `config_value_invalid` and a fix, the first saying to name the variable that holds the token, with both files unchanged

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-705 — A profile for a module or a requirement, with one command

<!-- specgate:trace status=Implemented feature=features/project-setup/REQ-705.feature actor=Developer kind=functional -->

The system SHALL, on `specgate config set profiles.<name>.match.module <module>` or `profiles.<name>.match.requirement <REQ-NNN>`, write that rule under the profile in `.harness/profiles.yaml`; and SHALL refuse a module the project does not have, naming the modules it has.

> "Specgate Studio has to be configurable" (2026-11-23): the studio's Settings › Agents saves through this.

#### Scenario: SCN-705a — ausleihe given its own agent

- GIVEN a project with the modules katalog and ausleihe
- WHEN the Developer runs `specgate config set profiles.careful.agent "claude -p < {prompt_file}"` and `specgate config set profiles.careful.match.module ausleihe`
- THEN `specgate harness doctor --no-probe --json` routes ausleihe's requirements to careful; and `config set profiles.careful.match.module pagos` is refused naming katalog and ausleihe

### Requirement: REQ-706 — The sandbox, set with one command per field

<!-- specgate:trace status=Implemented feature=features/project-setup/REQ-706.feature actor=Developer kind=functional -->

The system SHALL, on `specgate config set sandbox.<field> <value>` for `engine`, `kit`, `allow` (a comma-separated list), `setup`, `image` and `network`, write that field of the `sandbox:` block of harness.config.yaml, and SHALL refuse a value with which the harness would not read the block, saying why.

#### Scenario: SCN-706a — A swarm in sbx, set from the command line

- GIVEN a project with no sandbox
- WHEN the Developer sets `sandbox.engine sbx`, `sandbox.kit opencode`, `sandbox.allow "registry.npmjs.org, opencode.ai"` and `sandbox.setup "sh scripts/sandbox-setup.sh"`
- THEN harness.config.yaml's sandbox reads engine sbx, kit opencode, the two hosts and the setup; and `config set sandbox.engine lxc` is refused

### Requirement: REQ-707 — A setting, or a whole profile, removed with one command

<!-- specgate:trace status=Implemented feature=features/project-setup/REQ-707.feature actor=Developer kind=functional -->

The system SHALL, on `specgate config unset <key>`, remove that key from its file; `config unset profiles.<name>` SHALL remove the profile and `config unset sandbox` the whole block; a key that is not set is not an error.

#### Scenario: SCN-707a — careful removed

- GIVEN the profile careful with an agent and a rule for ausleihe
- WHEN the Developer runs `specgate config unset profiles.careful`
- THEN .harness/profiles.yaml has no profile careful, and ausleihe's requirements go to the default agent

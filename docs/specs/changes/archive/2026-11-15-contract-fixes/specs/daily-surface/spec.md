# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-563 — An unreadable harness config is said, not answered as empty

The system SHALL, when `harness.config.yaml` cannot be read, have `specgate config list --json` report the finding `harness_config_invalid` naming the file and the fix the reader gives, and exit 1, instead of answering the settings as unset.

#### Scenario: SCN-563a — A 0.35 lanes key

- GIVEN a project whose harness config has `roles: [tester, implementer]`
- WHEN a tool runs `specgate config list --json`
- THEN it exits 1 with `harness_config_invalid` on harness.config.yaml, whose fix names `lanes: [tester, implementer]`

<!-- specgate:trace status=Implemented feature=features/daily-surface/REQ-563.feature actor=Developer kind=functional -->

### Requirement: REQ-565 — The next step as data

The system SHALL add to `specgate status --json` the field `next`: the next command, its arguments without `specgate` (null when the next step is not a command), and whether an argument is still a `<…>` placeholder for a person to fill in; `nextCommand` SHALL stay as it is.

#### Scenario: SCN-565a — The next step as data

- GIVEN a project whose next step is `specgate apply REQ-007`
- WHEN a tool runs `specgate status --json`
- THEN `next.argv` is `["apply", "REQ-007"]`, `next.placeholder` is false, and `next.command` equals `nextCommand`

<!-- specgate:trace status=Implemented feature=features/daily-surface/REQ-565.feature actor=Developer kind=functional -->

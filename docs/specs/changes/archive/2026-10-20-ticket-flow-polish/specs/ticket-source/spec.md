# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-157 — A change reserves its scenario ids as it reserves its requirement ids

The system SHALL, when `propose --from-ticket` or `propose --from-brief <module>` opens a change, reserve three scenario ids per reserved requirement id, starting above every scenario id used or reserved on any branch, record them as `scn_range` in its `change.yaml`, and name that range in its `DRAFTING.md`, so that a change drafted later on another branch starts above it.

#### Scenario: SCN-157a — Two tickets opened before either is drafted

- GIVEN a project where KAN-14's change was opened with `scn_range: [SCN-002, SCN-019]` and not yet drafted
- WHEN the developer opens KAN-13 with `specgate propose --from-ticket KAN-13.json --capability parking`
- THEN KAN-13's `change.yaml` has a `scn_range` starting at SCN-020, and its `DRAFTING.md` names that range

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-158 — Status points a Jira project to its tickets

The system SHALL, when `specgate status` would suggest specifying a first behaviour — no requirement yet, or only the adoption baseline left — and `alm.config.yaml` names the `jira` provider, suggest `specgate propose --from-ticket <KEY> --check` instead of `specgate new`.

#### Scenario: SCN-158a — An adopted project connected to Jira

- GIVEN a freshly adopted project with `alm.config.yaml` naming `provider: jira`
- WHEN the developer runs `specgate status`
- THEN the next step is `specgate propose --from-ticket <KEY> --check`

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

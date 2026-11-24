# Delta — harness

## ADDED Requirements

### Requirement: REQ-688 — A module has its own agent

<!-- specgate:trace status=Implemented feature=features/harness/REQ-688.feature actor=Developer kind=functional -->

The system SHALL match a profile rule of `.harness/profiles.yaml` that says `match: { module: <name> }` against the capability of the requirement being built, as it matches the other keys — first match wins —, so that the harness hands that module's requirements to that profile's agent.

> "I could choose per module or per requirement which one I want to use" (2026-11-23).

#### Scenario: SCN-688a — ausleihe with its own agent

- GIVEN profiles `careful` with `match: { module: ausleihe }` and `cheap` with `match: { module: "*" }`, and REQ-006 of ausleihe and REQ-004 of katalog pending
- WHEN the harness builds them
- THEN REQ-006 is built by careful's agent and REQ-004 by cheap's

### Requirement: REQ-689 — The agent that drafts, set apart

<!-- specgate:trace status=Implemented feature=features/harness/REQ-689.feature actor=Developer kind=functional -->

The system SHALL read `draft_profile` in harness.config.yaml as the profile whose agent drafts, and SHALL run it on `specgate draft <module>` and `specgate propose --from-brief <module>` when neither `--agent` nor `--profile` is given; and SHALL keep writing the drafting guide for the Developer's own agent, running none, with `--no-agent` or when no `draft_profile` is set.

#### Scenario: SCN-689a — Drafted by its own agent

- GIVEN `draft_profile: writer` and the profile writer whose agent writes the module's delta
- WHEN the Developer runs `specgate draft pedidos`
- THEN writer's agent ran with the drafting guide, and not the harness's agent

### Requirement: REQ-690 — Every agent checked before it is used

<!-- specgate:trace status=Implemented feature=features/harness/REQ-690.feature actor=Developer kind=functional -->

The system SHALL, on `specgate harness doctor [--json] [--no-probe]`, list each pending requirement with its module and the profile and agent it gets; and SHALL check each distinct agent once — the drafting one too —: its program on the PATH, and, unless `--no-probe`, a probe that runs it on a prompt saying `Reply with exactly: OK`, passing when it exits 0 within 120 seconds and its output says OK; each failure with the last line the agent printed and a fix; exiting 1 when one fails.

#### Scenario: SCN-690a — One agent answers, one has an expired key

- GIVEN the default agent answers OK, and careful's agent prints "This API key has expired" and exits 1
- WHEN the Developer runs `specgate harness doctor --json`
- THEN the default agent passes, careful's fails with "This API key has expired", the requirements of ausleihe name careful, and the doctor exits 1

#### Scenario: SCN-690b — Not installed

- GIVEN a profile whose agent is `nosuchagent -p {prompt_file}`
- WHEN the Developer runs `specgate harness doctor --no-probe --json`
- THEN that agent fails as not installed, `nosuchagent` named, and no agent was run

### Requirement: REQ-691 — A run checks its agents before it starts

<!-- specgate:trace status=Implemented feature=features/harness/REQ-691.feature actor=Developer kind=functional -->

The system SHALL, on `specgate harness run`, before any worktree, run the doctor for the agents of the requirements it will process, and refuse to start with `harness_agent_unavailable` — naming the requirements, the agent and why — when one fails; and SHALL start anyway with `--skip-doctor`.

#### Scenario: SCN-691a — The agent of ausleihe does not answer

- GIVEN careful's agent prints "Free usage limit reached" and exits 1, and REQ-006 of ausleihe pending
- WHEN the Developer runs `specgate harness run`
- THEN the harness refuses with `harness_agent_unavailable` naming REQ-006 and "Free usage limit reached", and no worktree was created

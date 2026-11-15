# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-567 — A 0.35 project reaches 1.0 in one command

The system SHALL, on a project 0.35 left — open changes without layers, the lanes under `roles:`, agent scripts that read `SPECGATE_ROLE` — name `specgate migrate 1.0` in `specgate status` (and in `status --json`'s `migrate`, with `config: true` when the harness config needs it, even with no open change to migrate); and `specgate migrate 1.0` SHALL layer the open changes keeping every other line of their `change.yaml`, rename the lanes, and list each tracked file that reads `SPECGATE_ROLE` among what a person must still do.

#### Scenario: SCN-567a — A 0.35 project, moved to 1.0 in one command

- GIVEN a committed 0.35 project with an open change of kind bug, `roles: [tester, implementer]` and scripts/agent.sh reading `SPECGATE_ROLE`
- WHEN a developer runs `specgate status`, then `specgate migrate 1.0`
- THEN status names the migration; afterwards the change is layered and still of kind bug, the harness config says `lanes:` and loads, the report names scripts/agent.sh, and status no longer names the migration

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-567.feature actor=Developer kind=functional -->

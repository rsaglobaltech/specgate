Feature: A 0.35 project reaches 1.0 in one command

  @REQ-567 @SCN-567a
  Scenario: A 0.35 project, moved to 1.0 in one command
    Given a committed 0.35 project with an open change of kind bug, `roles: [tester, implementer]` and scripts/agent.sh reading `SPECGATE_ROLE`
    When a developer runs `specgate status`, then `specgate migrate 1.0`
    Then status names the migration; afterwards the change is layered and still of kind bug, the harness config says `lanes:` and loads, the report names scripts/agent.sh, and status no longer names the migration

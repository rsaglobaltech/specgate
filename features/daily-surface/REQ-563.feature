Feature: An unreadable harness config is said, not answered as empty

  @REQ-563 @SCN-563a
  Scenario: A 0.35 lanes key
    Given a project whose harness config has `roles: [tester, implementer]`
    When a tool runs `specgate config list --json`
    Then it exits 1 with `harness_config_invalid` on harness.config.yaml, whose fix names `lanes: [tester, implementer]`

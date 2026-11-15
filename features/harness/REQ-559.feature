Feature: The lanes are not the roles

  @REQ-559 @SCN-559a
  Scenario: A 0.35 project's lanes
    Given a committed project whose harness config has the line `roles: [tester, implementer]`
    When a developer runs `specgate migrate 1.0`
    Then the line reads `lanes: [tester, implementer]`, every other byte of the file is unchanged, and the report still asks who holds product, architect and developer

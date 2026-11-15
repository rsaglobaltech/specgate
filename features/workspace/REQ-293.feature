Feature: A qualified id names a requirement that exists

  @REQ-293 @SCN-293a
  Scenario: A qualified id that names nothing
    Given fleet's spec.md names contracts:REQ-000, contracts:REQ-099 and billing:REQ-001, and contracts has only REQ-000
    When the developer runs `specgate workspace check`
    Then it fails on contracts:REQ-099, which contracts does not have, and on billing:REQ-001, since billing is not a repo of the workspace, and not on contracts:REQ-000

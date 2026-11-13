Feature: A baseline lets an existing project adopt the gate

  @REQ-531 @SCN-531a
  Scenario: An old finding passes, a new one fails
    Given a project where REQ-001 is `Implemented` with no test that names it, and `specgate check --baseline` has run
    When REQ-002 is set `Implemented` with no test that names it and a tool runs `specgate check --json`
    Then it fails with one finding for REQ-002, and reports REQ-001's finding as `baselined`

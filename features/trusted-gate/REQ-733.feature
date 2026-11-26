Feature: The harness gate runs the requirement's scenarios

  @REQ-733 @SCN-733a
  Scenario: Built to a test that says something else
    Given a project with `bdd: required`, REQ-004 pending, and an agent whose code passes the test command and fails REQ-004's scenarios
    When the Developer runs `specgate harness run --req REQ-004 --max-attempts 1`
    Then REQ-004 fails at the stage `scenarios`, is not Implemented, and the report names the scenario that failed

  @REQ-733 @SCN-733b
  Scenario: Its scenarios pass
    Given the same project and an agent whose code passes the test command and REQ-004's scenarios
    When the Developer runs `specgate harness run --req REQ-004`
    Then the gate's stages include `scenarios`, passed, and REQ-004 is Implemented

  @REQ-733 @SCN-733c
  Scenario: Not required, not run
    Given a project whose gate.yaml does not say `bdd: required`
    When the Developer runs `specgate harness run --req REQ-004`
    Then the gate has no stage `scenarios`

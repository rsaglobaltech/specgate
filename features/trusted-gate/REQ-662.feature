@change:bdd-gate
Feature: Apply runs the requirement's scenarios

  @REQ-662 @SCN-662a
  Scenario: A scenario failing
    Given a project with `bdd: required` and a `bdd_cmd` that fails for `@REQ-031`
    When the Developer runs `specgate apply REQ-031`
    Then apply refuses with `apply_bdd_failed`, the command it ran naming `@REQ-031`, and REQ-031 is not Implemented

  @REQ-662 @SCN-662b
  Scenario: Its scenarios pass, it is delivered
    Given the same project whose `bdd_cmd` passes for `@REQ-031`
    When the Developer runs `specgate apply REQ-031`
    Then REQ-031 is Implemented

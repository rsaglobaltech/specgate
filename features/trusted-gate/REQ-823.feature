Feature: apply shows the scenarios as a stage

  @REQ-823 @SCN-823a
  Scenario: Delivered with its scenarios
    Given REQ-031 approved, with `bdd: required` and a `bdd_cmd` that passes for `@REQ-031`
    When the Developer runs `specgate apply REQ-031`
    Then the output shows `Scenarios` and the command after `Tests`, and REQ-031 is delivered

Feature: The adoption baseline is not a feature runner's scenario

  @REQ-822 @SCN-822a
  Scenario: Migrated with the baseline
    Given a project with `features/adoption/baseline.feature` untagged and `bdd: required`
    When the Developer runs `specgate check`, then `specgate migrate bdd`, then `specgate check` again
    Then the first check warns `bdd_baseline_runs`, the migration tags the scenario `@skip` and says so, and the second check does not warn

@change:sealed-acceptance
Feature: No tool of the agent writes a sealed test

  @REQ-760 @SCN-760a
  Scenario: Each road refused
    Given `features/steps/fees.steps.ts` sealed
    When the agent's tool asks to Write it, to apply a patch that touches it, or to run `sed -i … features/steps/fees.steps.ts`
    Then each is refused with `acceptance_sealed`

  @REQ-760 @SCN-760b
  Scenario: Changed where no hook runs
    Given the same sealed file and a run judged from outside
    When the file is changed by a process the guard does not see
    Then the judge reports the acceptance test of the change as changed

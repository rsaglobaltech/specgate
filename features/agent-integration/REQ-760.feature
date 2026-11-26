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

  @REQ-760 @SCN-760c
  Scenario: The sealed test came first
    Given a sealed acceptance test that names REQ-002, committed before the agent starts, and no other test changed
    When the agent's tool asks to write `src/fees.js`
    Then the write is allowed: the sealed test is the test that names the requirement

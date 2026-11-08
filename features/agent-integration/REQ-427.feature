Feature: With every requirement applied, the guard names none

  @REQ-427 @SCN-427a
  Scenario: Nothing left to apply
    Given an open change `module-map` whose requirements are all Implemented
    When the agent tries to write `src/core/map/scan.ts`
    Then the edit is denied with "every requirement of `module-map` is applied" and the two commands, and no REQ id

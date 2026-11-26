Feature: The exam proves sealed acceptance holds

  @REQ-761 @SCN-761a
  Scenario: The attack replayed
    Given the two-function fixture with its step file sealed
    When `specgate compat attack two-function` runs
    Then every write of the attack is refused by the guard or reported by the judge, and the command passes

  @REQ-761 @SCN-761b
  Scenario: The writer sees no source
    Given a trap task at level `L3a`
    When the writer agent starts
    Then its folder has the specification and the design's interfaces, and no `src/`

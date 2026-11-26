Feature: How much each module has earned

  @REQ-674 @SCN-674a
  Scenario: Ready for a promotion
    Given catalogo at level 3 with 10 requirements applied since its last leak and no failed attempt
    When the Developer runs `specgate trust --json`
    Then catalogo has `level` 3, `name` "verified", `streak` 10 and `ready` true, with `next` "specgate trust promote catalogo"

  @REQ-674 @SCN-674b
  Scenario: A leak resets the streak
    Given catalogo with a streak of 7 and then a bug change proposed for it
    When the Developer runs `specgate trust`
    Then catalogo shows a streak of 0 and one leak, and is not ready

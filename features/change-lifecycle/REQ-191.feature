Feature: What a change to a requirement touches

  @REQ-191 @SCN-191a
  Scenario: The impact of one requirement
    Given REQ-017 is defined in capabilities/fichas, has features/fichas/REQ-017.feature, a test naming it, a commit "feat(REQ-017)" that changed FichasContent.ts, and REQ-085 names REQ-017
    When `specgate change impact REQ-017` runs
    Then it lists the spec file and line, the feature, the test, FichasContent.ts and REQ-085

  @REQ-191 @SCN-191b
  Scenario: The impact of a change
    Given change gears modifies REQ-017 and REQ-018
    When `specgate change impact gears` runs
    Then it lists the impact of REQ-017 and of REQ-018

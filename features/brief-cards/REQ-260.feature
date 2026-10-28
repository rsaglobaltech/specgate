Feature: The guide is removed once the front matter is complete

  @REQ-260 @SCN-260a
  Scenario: The agent's front matter needs no fix
    Given `docs/brief.md` without a front matter, and an agent that writes a complete one
    When `specgate draft --agent` runs
    Then `docs/specs/BRIEF-SETUP.md` does not exist

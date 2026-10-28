Feature: The setup guide asks for the brief's own names

  @REQ-253 @SCN-253a
  Scenario: The guide an agent reads
    Given any brief
    When `specgate draft --agent` writes `docs/specs/BRIEF-SETUP.md`
    Then it says to name actors as the brief writes them, in its language, three to eight modules, and only the surfaces `forja.config.json` lists

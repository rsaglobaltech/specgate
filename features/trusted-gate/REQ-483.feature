Feature: A requirement id in a scenario's title declares nothing

  @REQ-483 @SCN-483a
  Scenario: A scenario that names another requirement
    Given a change whose delta declares REQ-086 with the scenario "#### Scenario: SCN-252 — Apply on REQ-030 in the browser", and no REQ-030 anywhere else
    When the developer runs `specgate validate . --strict`
    Then it reports no TDD-3 finding for REQ-030, and REQ-086 is still declared

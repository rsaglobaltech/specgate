Feature: A rule citing a law names its source

  @REQ-416 @SCN-416a
  Scenario: A driving-time rule cites the regulation
    Given contracts' change track-fleet has REQ-004, a business rule citing "the EU regulation on driving times" with no `Source:`
    When the developer runs `specgate change instructions specs track-fleet --json` and `specgate change approve track-fleet --json`
    Then the instructions show `Source: Regulation (EC) No 561/2006`, and approve is refused naming that REQ-004 names no source, with the fix `REQ-004: Add a "Source:" line`

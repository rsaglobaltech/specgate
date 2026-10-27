Feature: DRAFTING.md gives the draft's real limit

  @REQ-194 @SCN-194a
  Scenario: The range is the limit
    Given a draft reserving REQ-002 to REQ-011 with a review limit of 25
    When DRAFTING.md is written
    Then it says "`REQ-002` … `REQ-011`: 10 ids, no others" and names `specgate draft --reserve <n>`, and not "at most 25 requirements"

Feature: The report titles a scenario from the specification

  @REQ-280 @SCN-280a
  Scenario: A delivered requirement of a draft
    Given REQ-002 is in the open change `draft-fleet-tracking`, whose delta names `SCN-002 — A registered tracker reports a position` and whose `DRAFTING.md` shows `SCN-002 — <what happens>`
    When the studio's report lists REQ-002's scenarios
    Then SCN-002 is titled "A registered tracker reports a position"

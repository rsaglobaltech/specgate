Feature: A requirement coded by hand, delivered from the studio

  @REQ-441 @SCN-441a
  Scenario: Apply refused because no test names the requirement
    Given REQ-001 with no test that names it
    When it is delivered from the studio
    Then it stays Draft, and the studio says no test names REQ-001 yet

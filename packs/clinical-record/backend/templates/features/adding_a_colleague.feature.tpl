Feature: Adding a colleague

  @REQ-402 @SCN-403
  Scenario: Adding a colleague
    Given the case of "Laura Gómez Pérez" held by "MED-1"
    When "MED-1" adds "MED-2" to the care team and "MED-2" reads the timeline
    Then both requests succeed

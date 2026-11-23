Feature: A draft writes each use case's specification

  @REQ-632 @SCN-632a
  Scenario: The guide asks for it
    Given a brief with the module bookings
    When the Developer runs `specgate draft bookings`
    Then DRAFTING.md has a section on use-cases/UC-NNN.md with a main flow naming a scenario and an alternative at a step

  @REQ-632 @SCN-632b
  Scenario: A draft held back by its specification
    Given the bookings draft with UC-900 delivered by REQ-002 and its scenarios SCN-002 and SCN-003
    When UC-900 has no specification, then one whose flows name only SCN-002
    Then the draft is not ready with `D15_no_spec`, then with `D15_ucs_scenario_unflowed` naming SCN-003; with both named it is ready to review

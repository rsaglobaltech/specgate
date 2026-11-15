Feature: Live is a section of the studio

  @REQ-433 @SCN-433a
  Scenario: A run followed live
    Given a harness run on REQ-025 in its tests stage
    When the Live section is open and the run writes a test result
    Then the result appears in the log without a reload, Tests is the current stage, and REQ-026 is listed as queued

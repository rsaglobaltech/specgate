@change:compat-evidence
Feature: Recovering from a red gate

  @REQ-722 @SCN-722a
  Scenario: Left red
    Given an agent that implements the requirement and leaves the failing gate as it found it
    When the run is judged
    Then the run fails

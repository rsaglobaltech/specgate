Feature: A request with no requirement

  @REQ-723 @SCN-723a
  Scenario: Implemented straight away
    Given an agent that writes src/export.js and proposes nothing
    When the run is judged
    Then the run fails with the reason "code without a requirement"

  @REQ-723 @SCN-723b
  Scenario: Proposed first
    Given an agent that runs `specgate propose` and writes a requirement for the export
    When the run is judged
    Then the run passes

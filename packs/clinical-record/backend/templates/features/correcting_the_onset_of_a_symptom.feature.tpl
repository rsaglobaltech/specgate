Feature: Correcting the onset of a symptom

  @REQ-404 @SCN-406
  Scenario: Correcting the onset of a symptom
    Given the symptom "Dry cough at night" since 2026-09-20, recorded by "MED-1"
    When "MED-1" adds a correction citing it with the text "Actual onset: 2026-09-13"
    Then the timeline shows the original symptom and the correction citing it, each with its author and time

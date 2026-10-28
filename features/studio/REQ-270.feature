Feature: The studio's report judges the project as check does

  @REQ-270 @SCN-270a
  Scenario: A draft's requirement delivered before the draft is archived
    Given REQ-002 is only in the open change `draft-flota`, and `features/flota/REQ-002.feature` is written
    When the studio's report runs its specification gate
    Then the gate passes, while the bare `validate --strict` still names the feature missing from the matrix

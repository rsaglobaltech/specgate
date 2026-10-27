Feature: A draft is approved by a person

  @REQ-206 @SCN-206a
  Scenario: Approving a ready draft
    Given draft-garaje passes its checklist and has no open question
    When `specgate change approve draft-garaje` runs
    Then change.yaml says approved with today's date, and the draft leaves Review

  @REQ-206 @SCN-206b
  Scenario: A draft with an open question is not approved
    Given draft-garaje has an open question
    When it is approved
    Then it is refused naming the question, and change.yaml is unchanged

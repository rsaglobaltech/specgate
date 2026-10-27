Feature: Asking a draft for a change in your own words

  @REQ-207 @SCN-207a
  Scenario: A note on a requirement
    Given draft-garaje holds REQ-212
    When `specgate change note draft-garaje "Mejor 2 horas antes" --req REQ-212` runs
    Then review.md holds the note with REQ-212 and the date, and Review lists it under the draft

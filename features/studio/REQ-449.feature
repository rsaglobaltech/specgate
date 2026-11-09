Feature: A requested change, said for what it is

  @REQ-449 @SCN-449a
  Scenario: Asked, not yet done
    Given the draft `draft-orders` to review, with REQ-001
    When a change is asked for REQ-001 with "Cancel up to 24 h before shipping"
    Then the notice says it was noted in review.md and that the draft changes when it is drafted again, and the note is listed as open under REQ-001

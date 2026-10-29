Feature: What the ticket gains comes back as notes

  @REQ-306 @SCN-306a
  Scenario: A comment and a new description
    Given the open change `alerts` with `ticket: FLEET-12`, pulled once, and FLEET-12 then gains the comment "Also by SMS" and a changed description
    When `specgate alm pull` runs twice
    Then `alerts/review.md` gains one note with the comment and one saying the description changed, the second pull adds nothing, and the delta is unchanged

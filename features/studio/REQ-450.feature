Feature: A draft drafted again with the changes asked

  @REQ-450 @SCN-450a
  Scenario: Drafted again with one note
    Given `draft-orders` with an open note on REQ-001, "Cancel up to 24 h before shipping"
    When it is drafted again from the studio
    Then DRAFTING.md lists that note under REQ-001, the note is addressed once the draft is checked, and the studio shows REQ-001's text before and after

Feature: Approving with requested changes still open

  @REQ-451 @SCN-451a
  Scenario: One note still open
    Given `draft-orders` ready to approve, with one open note on REQ-001
    When Approve the draft is pressed
    Then the studio says one requested change is still open, on REQ-001, and approves only after the person confirms

Feature: The studio's Review shows and takes layer approvals

  @REQ-319 @SCN-319a
  Scenario: Ana approves the Discover from the studio
    Given a draft with its layers written and ana@acme.eu as product
    When the studio is asked for the drafts and then posts an approval of the Discover as ana@acme.eu
    Then the Discover reads as owned by the viewer, and after the post it is approved by ana@acme.eu

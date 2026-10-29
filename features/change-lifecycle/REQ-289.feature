Feature: The studio's review shows the layers

  @REQ-289 @SCN-289a
  Scenario: Reviewing a layered draft
    Given a layered draft whose Discover is written and whose design is still the template
    When the studio's review data is read (`/api/drafts`)
    Then the draft lists discover (product, written), design (architect, not written) and tasks (developer)

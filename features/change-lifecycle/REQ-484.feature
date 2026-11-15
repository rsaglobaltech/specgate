Feature: A draft's review notes, as JSON

  @REQ-484 @SCN-484a
  Scenario: One note addressed, one open
    Given `draft-orders` whose review.md has N1 on REQ-001, addressed by a redraft that changed REQ-001's text, and N2 on no requirement, open
    When a tool runs `specgate change show draft-orders --json` and calls `change(dir, "draft-orders")`
    Then both answers are equal; N1 is `addressed`, with REQ-001's delta file, its line, and its text before and after the redraft; N2 is `open` with a null requirement

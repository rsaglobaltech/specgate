Feature: The review and the acceptance list the acceptance criteria

  @REQ-560 @SCN-560a
  Scenario: A layered change reviewed and accepted
    Given a change whose Discover says why in its Context and numbers AC-1 and AC-2
    When a product owner runs `specgate review` then `specgate acceptance` on it
    Then the page shows the Context under "Why" and both criteria under "Acceptance criteria", and the checklist has an unchecked item for each criterion

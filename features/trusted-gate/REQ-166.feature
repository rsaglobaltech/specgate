Feature: Capability specs merge requirement by requirement

  @REQ-166 @SCN-166a
  Scenario: Two branches add to a capability that did not exist
    Given a repository with the merge drivers registered, a branch that archived REQ-009 into a new `owners` capability, and another that archived REQ-006 and REQ-007 into it
    When the second branch is merged into the first
    Then the merge succeeds without a conflict and `owners/spec.md` lists REQ-006, REQ-007 and REQ-009, in that order

  @REQ-166 @SCN-166b
  Scenario: Both sides rewrote the same requirement
    Given the same requirement REQ-009 rewritten differently on each side
    When the branches are merged
    Then the merge stops with a conflict around REQ-009 only, and every other requirement is merged

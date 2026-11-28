Feature: One page shows a change's evidence

  @REQ-807 @SCN-807a
  Scenario: One before, one missing
    Given draft-orders with REQ-031, which has a before and an after with screenshots, and REQ-032, delivered with no before
    When the Developer runs `specgate evidence draft-orders`
    Then EVIDENCE.md shows REQ-031's two screenshots side by side, and says REQ-032 has no before with `specgate evidence before REQ-032`

Feature: reverse drafts one module into a change

  @REQ-529 @SCN-529a
  Scenario: The agent drafts the orders module
    Given the project of SCN-528a and an agent that answers two requirements with one scenario each for `orders`
    When a tool runs `specgate reverse orders --json`
    Then it exits 0, `docs/specs/changes/reverse-orders/` holds a delta with the two requirements, both `Draft`, and `spec.md` is unchanged

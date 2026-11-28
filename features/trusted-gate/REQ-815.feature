Feature: The page says why each scenario was red

  @REQ-815 @SCN-815a
  Scenario: Red before, green after
    Given REQ-031 whose before log has `✘ … › Paying @REQ-031 (18.7s)` failing at `Then the response is 422` with `Expected: 422` and `Received: 500`, and whose after log has `✓ … › Paying @REQ-031 (10.5s)`
    When the Developer runs `specgate evidence draft-orders`
    Then the page's row for Paying shows ✘ 18.7s with `Expected: 422 · Received: 500` before, and ✓ 10.5s after

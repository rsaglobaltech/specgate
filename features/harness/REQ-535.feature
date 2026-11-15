Feature: A requirement has a cost budget

  @REQ-535 @SCN-535a
  Scenario: The first attempt spends the budget
    Given `max_cost_usd: 0.5` and an agent that writes a usage line with a cost of 0.6 and a test that fails the gate
    When a tool runs `specgate harness run --req REQ-000`
    Then the requirement fails after one attempt, and the output reports `budget_exceeded` with 0.60 and 0.5

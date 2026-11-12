Feature: The agent's plans through the API

  @REQ-527 @SCN-527a
  Scenario: Ask, list and apply in-process
    Given the project of SCN-520a
    When a Node program calls `agentAsk(dir, "…")`, `agentPlans(dir)`, then `agentApply(dir, id)`, and `agentDiscard(dir, "nope")`
    Then the plan, the list and the applied answer have the shapes the commands print, `spec.md` holds the agent's line, and the discard rejects with the code `plan_not_found` and the fix `specgate agent plans`

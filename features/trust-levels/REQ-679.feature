@change:feature-map
Feature: The agent is told where the requirement lives in the app

  @REQ-679 @SCN-679a
  Scenario: Opened before and after
    Given the project of SCN-678a
    When the harness builds the prompt for REQ-031
    Then it has "Where it lives in the app" with "/orders/A-1", "http://localhost:5173/orders/A-1" and "e2e/cancel.spec.ts", and asks the agent to open the address before and after the change

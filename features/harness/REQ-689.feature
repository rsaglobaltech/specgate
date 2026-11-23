@change:agent-routing
Feature: The agent that drafts, set apart

  @REQ-689 @SCN-689a
  Scenario: Drafted by its own agent
    Given `draft_profile: writer` and the profile writer whose agent writes the module's delta
    When the Developer runs `specgate draft pedidos`
    Then writer's agent ran with the drafting guide, and not the harness's agent

Feature: A drafted story keeps none of its form's hints

  @REQ-364 @SCN-364a
  Scenario: The agent fills Intent and criteria
    Given a story scaffolded with its hints, and an agent that writes the Intent and AC-1 below them
    When the developer runs `specgate workspace draft follow-shipment --agent "<cmd>"`
    Then `story.md` holds the agent's text and no `<!--` line under Intent or Acceptance criteria

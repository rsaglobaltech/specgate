Feature: A repository whose criteria drift from the story

  @REQ-343 @SCN-343a
  Scenario: Fleet rewrites AC-1
    Given follow-shipment split across fleet and tracking, and fleet's `discover.md` AC-1 reworded
    When the developer runs `specgate workspace check --json`
    Then it warns `workspace_story_diverged` for fleet, and not for tracking

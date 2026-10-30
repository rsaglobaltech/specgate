Feature: A repository the workspace does not have, or cannot find

  @REQ-412 @SCN-412a
  Scenario: An unknown and a missing repository
    Given the workspace truck-flote has fleet and tracking, and fleet's folder has been removed
    When the developer opens `/live/repo/billing/` and `/live/repo/fleet/live.json`
    Then the first is 404 naming fleet and tracking, and the second is 404 saying fleet's folder is missing

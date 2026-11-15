Feature: The workspace's live view

  @REQ-323 @SCN-323a
  Scenario: Studio in the workspace repository
    Given a workspace of fleet and tracking
    When the developer starts `specgate studio` in the workspace repository and opens /live.json and /live
    Then /live.json is the workspace model with both repositories, and /live is the workspace's page

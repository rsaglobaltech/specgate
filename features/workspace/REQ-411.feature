Feature: The workspace's live view leads to each repository's

  @REQ-411 @SCN-411a
  Scenario: A panel opens its repository
    Given the workspace truck-flote has fleet and tracking
    When the developer opens the workspace's `/live`
    Then the page links to `/live/repo/` followed by each repository's name

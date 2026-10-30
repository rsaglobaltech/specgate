Feature: The new features of 1.0, page by page

  @REQ-402 @SCN-402a
  Scenario: The page keeps up with the changelog
    Given CHANGELOG.md has sections for 1.0.0-rc.1 to the latest candidate
    When the site is built
    Then `whats-new-1.0.html` exists, is in the sidebar, and names each of those candidates

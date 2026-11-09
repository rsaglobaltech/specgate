Feature: The studio is built from typed source and carries no runtime dependency

  @REQ-432 @SCN-432a
  Scenario: What the package ships
    Given Specgate built and packed
    When its package is read
    Then it holds the studio's script and styles, its `dependencies` are empty, and the page loads nothing from another host

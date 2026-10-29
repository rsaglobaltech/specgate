Feature: The status of a workspace repository

  @REQ-341 @SCN-341a
  Scenario: A workspace with its brief and no story
    Given the workspace above, before any story
    When the developer runs `specgate status` in the workspace repository
    Then it exits 0, names the workspace and its repositories, and says `specgate workspace draft`

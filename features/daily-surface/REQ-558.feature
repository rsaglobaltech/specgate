Feature: The after-archive copy keeps a symlink

  @REQ-558 @SCN-558a
  Scenario: A linked node_modules
    Given a project in git with an open change and an untracked symlink `node_modules` pointing at a folder
    When a developer runs `specgate check`
    Then the gate runs, and does not fail copying the symlink

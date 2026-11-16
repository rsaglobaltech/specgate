Feature: One download cache for every worktree

  @REQ-589 @SCN-589a
  Scenario: The second worktree reads from disk
    Given `dependency_cache: true`
    When a worktree's setup runs
    Then `npm_config_cache` names `.harness/cache/npm` of the project, and git shows nothing new

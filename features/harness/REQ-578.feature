Feature: One run holds a working copy, and a dead run does not keep it

  @REQ-578 @SCN-578a
  Scenario: A second run while the first holds the lock
    Given a run holding the project's lock
    When a second run asks for it, and later a run asks for a lock whose process has ended
    Then the second run is refused, and the later run takes the dead run's lock

  @REQ-578 @SCN-578b
  Scenario: A project that is itself a worktree
    Given a project whose `.git` is a file naming its repository
    When the harness takes the worktree lock
    Then it takes it at once, in the repository's git directory

Feature: check leaves the working tree as it was

  @REQ-256 @SCN-256a
  Scenario: A check in a clean repository
    Given a git repository with nothing to commit
    When `specgate check` records its result for the pet
    Then `git status --porcelain` is still empty, and the pet reads the result back

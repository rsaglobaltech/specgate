Feature: The generated matrix never blocks a merge

  @REQ-122 @SCN-122a
  Scenario: Two branches deliver two requirements
    Given a project with a generated matrix and two branches, each delivering a different requirement through `specgate apply`
    When the second branch is merged with `git merge`
    Then git reports no conflict, and `specgate check` on the result passes with both requirements Implemented in the matrix

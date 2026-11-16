Feature: A chain undoes a merge to where the branch stood

  @REQ-574 @SCN-574a
  Scenario: A merge commit the repository refuses
    Given a chain run on a branch whose last commit is the person's, and a commit-msg hook that refuses the chain's merge commit
    When the first requirement passes and is merged
    Then the requirement fails naming the refused merge commit, and the branch points at the person's commit with its own tree and nothing staged

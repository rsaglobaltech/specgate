Feature: In team mode, edits arrive as pull requests

  @REQ-554 @SCN-554a
  Scenario: An editor answers a question
    Given `studio --team` with `luis` as `editor` and an open question in the change `pdf-invoices`
    When `luis` answers it through the studio
    Then a commit authored by `luis` exists on `studio/luis/pdf-invoices`, a pull request to the base branch is open with it, the base branch has no new commit, and the answer holds the pull request's URL

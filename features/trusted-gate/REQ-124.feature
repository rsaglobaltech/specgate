Feature: Harness prompts never reach the base branch

  @REQ-124 @SCN-124a
  Scenario: A chained requirement's merge
    Given a project whose harness delivers one requirement with `--chain`
    When the developer lists the files the merge commit adds to the base branch
    Then no file under `.specops/harness-prompts/` is among them, and the requirement's `harness/` branch still holds its prompt

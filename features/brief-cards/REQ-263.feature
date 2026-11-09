Feature: `status` says when the answer is in and the spec is not

  @REQ-263 @SCN-263a
  Scenario: The client answered Q5
    Given REQ-010 `Needs Clarification`, blocked by Q5 only, and Q5 answered in its `questions.md`
    When `specgate status` runs
    Then REQ-010 is under "Answered — update the spec" with Q5, and not under "Waiting for an answer"

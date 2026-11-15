Feature: Each open question carries its options

  @REQ-479 @SCN-479a
  Scenario: Q2 and its two options
    Given the draft `draft-orders`, whose Q2 lists "before shipping; within 24 h" as the options seen
    When a tool runs `specgate questions --json`
    Then Q2 in its answer has `options` `["before shipping", "within 24 h"]`, and the API's `questions(dir)` gives the same

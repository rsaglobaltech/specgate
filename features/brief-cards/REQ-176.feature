@change:draft-warnings
Feature: A question that blocks nothing says so

  @REQ-176 @SCN-176a
  Scenario: "none" is a warning
    Given a draft whose questions.md has the open question Q4 "Should it export a backup?" with Blocks "none"
    When the draft is checked
    Then the only D7 finding is the warning D7_question_blocks_nothing naming Q4

  @REQ-176 @SCN-176b
  Scenario: An empty Blocks cell is still refused
    Given the same question with an empty Blocks cell
    When the draft is checked
    Then D7_floating_question is an error whose fix names "none"

  @REQ-176 @SCN-176c
  Scenario: The warning alone leaves the draft ready
    Given a complete draft whose only finding is the warning D7_question_blocks_nothing for Q4
    When the Developer runs `specgate draft bookings`, then `specgate draft --check draft-bookings`
    Then both show the warning, say Ready to review and end with 0, and `--json` says the draft is ready

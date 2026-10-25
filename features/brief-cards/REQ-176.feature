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

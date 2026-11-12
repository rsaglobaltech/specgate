Feature: A requirement whose agent asked ends waiting for the answer

  @REQ-495 @SCN-495a
  Scenario: The result names the question to answer
    Given a fake agent that asks "Which currency?" for REQ-000
    When `specgate harness run --format json` ends
    Then REQ-000's result is `question` after one attempt, with `waitingForAnswer.id` Q1, its text, and `answer` naming `specgate answer Q1`

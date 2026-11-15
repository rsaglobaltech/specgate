Feature: One way to write and read an answer

  @REQ-429 @SCN-429a
  Scenario: The same answer everywhere
    Given Q1 answered in its `Answer` cell and Q2 by a line `Answer (Q2): 30 days` under the table
    When `specgate questions`, the studio and the draft checklist read `questions.md`
    Then all three count Q1 and Q2 as answered

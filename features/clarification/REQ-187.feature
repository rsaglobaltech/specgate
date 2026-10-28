Feature: Everything waiting for an answer, in one list

  @REQ-187 @SCN-187a
  Scenario: Open questions from every change, answered ones left out
    Given change draft-examen has Q1 answered and Q6 open blocking REQ-049, and change draft-diario has Q2 open blocking nothing
    When `specgate questions` runs
    Then it lists Q6 of draft-examen with REQ-049 and Q2 of draft-diario, and not Q1

  @REQ-187 @SCN-187b
  Scenario: A requirement waiting with no question is listed too
    Given REQ-030 is in `Needs Clarification` and no open question names it
    When `specgate questions` runs
    Then it lists REQ-030 under the requirements waiting without a question

  @REQ-187 @SCN-187c
  Scenario: Nothing open
    Given no change has an open question and no requirement is in `Needs Clarification`
    When `specgate questions` runs
    Then it says nothing waits for an answer and exits 0

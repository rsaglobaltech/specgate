Feature: The agent can ask instead of guessing

  @REQ-189 @SCN-189a
  Scenario: Asking records the question and the requirement waits
    Given REQ-049 is defined by change draft-examen, whose last question is Q7
    When `specgate ask REQ-049 "Which photo of Königsbrücker Straße?"` runs
    Then draft-examen's questions.md gains Q8 with that text blocking REQ-049, and REQ-049 is `Needs Clarification`

  @REQ-189 @SCN-189b
  Scenario: The harness stops the requirement without spending its attempts
    Given an agent that runs `specgate ask` for its requirement during attempt 1 of 3
    When the attempt ends
    Then the requirement's result is `needs clarification` with the question, no second attempt runs, the events record the question, and the project has a commit adding it to questions.md with the requirement `Needs Clarification`

  @REQ-189 @SCN-189c
  Scenario: The live view shows the question
    Given REQ-049's last attempt ended asking a question
    When the live model is read
    Then REQ-049 is in "Needs attention" with its question and `specgate answer Q8 "…"`

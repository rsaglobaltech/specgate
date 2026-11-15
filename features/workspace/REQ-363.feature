Feature: A story's questions wait for their answers

  @REQ-363 @SCN-363a
  Scenario: Q1 is open
    Given follow-shipment whose `questions.md` has Q1 with no answer
    When the developer runs `specgate workspace propose follow-shipment`, then answers Q1 and runs it again
    Then the first is refused naming Q1, and the second opens the story's changes

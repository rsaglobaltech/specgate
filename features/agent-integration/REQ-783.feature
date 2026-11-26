@change:walkthrough-fixes-2
Feature: A client's answer is a source for its requirements' values

  @REQ-783 @SCN-783a
  Scenario: The fee the client gave
    Given REQ-004's scenario charging "5 euros", the brief silent on the fee, and Q1, blocking REQ-004, answered "5 euros"
    When the draft is checked
    Then no `D6_unlisted_value` names "5 euros"; with Q1 unanswered, one does

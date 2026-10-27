Feature: Only defined ids reserve the next ones

  @REQ-202 @SCN-202a
  Scenario: A mention in a scenario reserves nothing
    Given the highest requirement is REQ-018 and a scenario says "GIVEN REQ-999 is defined nowhere"
    When a change reserves two ids
    Then it gets REQ-019 and REQ-020

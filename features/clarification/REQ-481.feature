Feature: Each question says where it was asked

  @REQ-481 @SCN-481a
  Scenario: A brief's question, a draft's and the agent's
    Given the draft `draft-orders`, opened from the brief, whose Q1 is the brief's question "From what amount is shipping free?" and whose Q2 the draft added
    When the agent building REQ-001 runs `specgate ask REQ-001 "Is the invoice sent by email?"` and a tool runs `specgate questions --json`
    Then Q1 has `asked` `brief`, Q2 has `asked` `draft`, the agent's Q3 has `asked` `build`, and the API's `questions(dir)` gives the same

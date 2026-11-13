Feature: A reversed requirement cites its evidence

  @REQ-530 @SCN-530a
  Scenario: A rule, a defect and a deleted file
    Given an agent that reverses `orders` into one requirement citing `src/orders/Cancel.java:12` and one behaviour it marks as suspect
    When a tool runs `specgate reverse orders --json`, deletes `src/orders/Cancel.java`, then runs `specgate validate --json`
    Then the delta has one requirement whose trace carries `source=src/orders/Cancel.java:12`, `questions.md` has one question for the suspect behaviour, and `validate` reports `source_missing` naming the deleted file

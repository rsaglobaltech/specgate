Feature: A ticked task keeps the approval of the tasks

  @REQ-370 @SCN-370a
  Scenario: The second requirement of an approved change
    Given a layered change with REQ-002 and REQ-003, every layer approved
    When REQ-002 is delivered and its task in tasks.md is ticked
    Then the harness still accepts REQ-003 as approved

  @REQ-370 @SCN-370b
  Scenario: A task reworded after the approval
    Given the same approved change
    When a task of tasks.md is reworded
    Then the harness refuses the change as not approved: tasks

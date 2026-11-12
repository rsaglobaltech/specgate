Feature: A question is recorded with its id as soon as the agent asks it

  @REQ-494 @SCN-494a
  Scenario: The id before the agent has finished
    Given a fake agent that runs `specgate ask REQ-000 "Which currency?"` and then waits until the project's questions list Q1
    When the harness runs REQ-000
    Then the agent sees Q1 in the project while it still runs, the events file has a `question` event with `id` Q1, and the question is committed

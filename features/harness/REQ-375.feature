Feature: Ticking a task is not an edit of the contract

  @REQ-375 @SCN-375a
  Scenario: The agent ticks the task it delivered
    Given an approved layered change of two requirements
    When the agent implements REQ-002 and ticks its task in tasks.md
    Then the attempt is not refused for a protected path

  @REQ-375 @SCN-375b
  Scenario: The agent rewrites a task
    Given the same change
    When the agent rewords REQ-002's task in tasks.md
    Then the attempt is refused with `agent_touched_protected_path`, naming tasks.md

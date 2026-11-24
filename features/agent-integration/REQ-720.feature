@change:compat-evidence
Feature: Several tasks, each with its verdict

  @REQ-720 @SCN-720a
  Scenario: The old case still holds
    Given the task `change` and an agent that implements the new cap and breaks the old one
    When the run is judged
    Then the hidden check fails and the run does not pass

  @REQ-720 @SCN-720b
  Scenario: An unknown task
    Given `specgate compat run --task nosuch`
    When the Developer runs it
    Then it is refused naming the tasks that exist, and no agent starts

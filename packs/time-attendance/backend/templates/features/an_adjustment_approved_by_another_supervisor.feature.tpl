Feature: An adjustment approved by another supervisor

  @REQ-706 @SCN-707
  Scenario: An adjustment approved by another supervisor
    Given a worker who forgot to clock out at 15:30
    When a supervisor adjusts the punch to 15:30 with the reason "forgot to clock out" and another supervisor approves it
    Then the original punch is unchanged and the timesheet shows the adjusted time with its approval

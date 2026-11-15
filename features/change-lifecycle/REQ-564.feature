Feature: change show says whether the change may be built

  @REQ-564 @SCN-564a
  Scenario: A change just proposed
    Given a change just proposed, with its three layers and no approval
    When a tool runs `specgate change show <id> --json`
    Then `change.approvals.approved` is false and `change.approvals.layers` lists discover, design and tasks

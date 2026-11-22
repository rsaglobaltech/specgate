@change:show-approval-blockers
Feature: `change show --json` says what blocks approval before Approve is pressed

  @REQ-619 @SCN-619a
  Scenario: A change approve would refuse
    Given a change whose question Q1 blocks REQ-001, which is not Needs Clarification
    When a client runs `specgate change show <id> --json`
    Then `change.blockers` lists `D7_floating_question` naming Q1 and REQ-001 with its fix, and every blocker's message is in the message `change approve` refuses with

  @REQ-619 @SCN-619b
  Scenario: A change nothing blocks
    Given a change `change approve` would accept
    When a client runs `specgate change show <id> --json`
    Then `change.blockers` is `[]`

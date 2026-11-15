Feature: The API answers what --json prints

  @REQ-466 @SCN-466a
  Scenario: Questions in-process and from the CLI
    Given a project with the draft `draft-orders`, whose open question Q2 blocks REQ-003
    When a program calls `questions(dir)` and runs `specgate questions --json` on the same project
    Then both answers are equal, and Q2 in them names `draft-orders` and blocks `REQ-003`

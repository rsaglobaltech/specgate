Feature: Updating Specgate updates the agent contract

  @REQ-155 @SCN-155a
  Scenario: A contract from an older Specgate
    Given an adopted project whose `AGENTS.md` block has the section "From a plan or brief", the stack "Java 21, Spring Boot (apps/api)", the project rule "The test command is `npm test`.", and the team's line "Ask Ana before touching billing." below the block, and no other generated agent files
    When the developer runs `specgate update`
    Then the block has the section "From a brief or a Jira ticket", the stack and the project rule are still there, the team's line is unchanged below the block, and the output names `AGENTS.md` as updated

Feature: The agent contract names the ticket path

  @REQ-154 @SCN-154a
  Scenario: The section is there
    Given a new project
    When the developer runs `specgate adopt --no-capabilities`
    Then `AGENTS.md` has a section "From a brief or a Jira ticket" naming `specgate propose --from-ticket`, `ticket.md` and the ticket key in commit messages

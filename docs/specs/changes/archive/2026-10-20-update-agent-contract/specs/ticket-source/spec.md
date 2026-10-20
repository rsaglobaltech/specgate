# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-155 — Updating Specgate updates the agent contract

The system SHALL, on `specgate update`, rewrite the Specgate block of `AGENTS.md` from the installed Specgate's template, keeping the facts the block states (project, architecture, domain, stack, API, testing) and its "Project rules" section, and the team's text outside the block unchanged; SHALL do so even when the project has no other generated agent files; SHALL report the block as updated, or unchanged when the template has not changed; and SHALL write nothing with `--dry-run`.

#### Scenario: SCN-155a — A contract from an older Specgate

- GIVEN an adopted project whose `AGENTS.md` block has the section "From a plan or brief", the stack "Java 21, Spring Boot (apps/api)", the project rule "The test command is `npm test`.", and the team's line "Ask Ana before touching billing." below the block, and no other generated agent files
- WHEN the developer runs `specgate update`
- THEN the block has the section "From a brief or a Jira ticket", the stack and the project rule are still there, the team's line is unchanged below the block, and the output names `AGENTS.md` as updated

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

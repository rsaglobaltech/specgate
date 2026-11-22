@change:verified-build
Feature: The agent runs without the person's MCP servers, and may run the gate's checks

  @REQ-650 @SCN-650a
  Scenario: No MCP server
    Given the harness's agent, a drafting agent and one with its own permission
    When Specgate runs them
    Then each carries `--strict-mcp-config` once, and one naming `--mcp-config` is kept as it is

  @REQ-650 @SCN-650b
  Scenario: The gate's checks allowed
    Given the test command `npm test` and the architecture check `npm run arch`
    When the harness gives the agent its permissions
    Then it may run both, and no other command

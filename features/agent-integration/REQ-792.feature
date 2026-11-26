@change:walkthrough-fixes-3
Feature: The MCP config tools declare and pass their key and value

  @REQ-792 @SCN-792a
  Scenario: Key and value
    Given a project
    When an MCP client calls `specgate_config_set` with `value: "on"` then `key: "pet"`, and with `agent_guard` `off`
    Then `pet` is on, and the guard is still on

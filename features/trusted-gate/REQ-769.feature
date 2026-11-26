@change:guard-switch-person
Feature: An MCP tool passes only the arguments it declares

  @REQ-769 @SCN-769a
  Scenario: An undeclared argument
    Given the MCP tool `specgate_config_set`, whose schema declares only the project folder
    When it is called with `{ "projectDir": <dir>, "a": "agent_guard", "b": "off" }`
    Then the CLI it runs is not given `agent_guard` or `off`, and the guard is still on

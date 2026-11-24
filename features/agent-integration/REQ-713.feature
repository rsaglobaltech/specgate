@change:harness-compat
Feature: Specgate's MCP server for Codex and OpenCode

  @REQ-713 @SCN-713a
  Scenario: OpenCode's file kept
    Given an opencode.json with a `model` key
    When the Developer runs `specgate mcp install --client opencode`
    Then opencode.json has `mcp.specgate` and still its `model`

  @REQ-713 @SCN-713b
  Scenario: Codex's home untouched
    Given a fake codex and CODEX_HOME pointing at an empty folder
    When the Developer runs `specgate compat run --tool codex --level L2 --runs 1`
    Then the fake codex was given the specgate server on its command line, and the folder is still empty

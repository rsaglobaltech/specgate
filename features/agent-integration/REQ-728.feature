@change:opencode-plugin-v2
Feature: The plugin's three jobs on OpenCode 2's hooks

  @REQ-728 @SCN-728a
  Scenario: Code before its test is refused
    Given REQ-002 pending with no test that names it
    When OpenCode 2 is about to run `write` on src/fees.js
    Then the plugin refuses it naming REQ-002, and the hook log has a refusal for src/fees.js

  @REQ-728 @SCN-728b
  Scenario: The gate speaks once
    Given a session whose agent stopped with a failing gate
    When `session.execution.succeeded` arrives twice for the same message
    Then the findings are sent into the session once

  @REQ-728 @SCN-728c
  Scenario: The session knows the change
    Given a project with the change draft-fees open
    When OpenCode 2 builds a model request
    Then the system text gains one part that names draft-fees

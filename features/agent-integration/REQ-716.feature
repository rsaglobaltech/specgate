Feature: The internal matrix

  @REQ-716 @SCN-716a
  Scenario: Three tools
    Given runs for claude, codex and opencode
    When the Developer runs `specgate compat report`
    Then matrix.md has three rows with their versions and models and four level columns, today's date, and docs/ is unchanged

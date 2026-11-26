Feature: The exam before a release

  @REQ-732 @SCN-732a
  Scenario: No run of this version
    Given runs recorded by an earlier version of Specgate only
    When the Developer runs `specgate compat check-release`
    Then it exits non-zero naming claude, codex and opencode as not examined with this version

  @REQ-732 @SCN-732b
  Scenario: Examined and green
    Given valid runs of the three tools at L0 on deliver with this version, all passed
    When the Developer runs `specgate compat check-release`
    Then it exits zero

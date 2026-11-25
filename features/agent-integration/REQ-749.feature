@change:person-approves
Feature: The exam proves which Specgate the agent reaches

  @REQ-749 @SCN-749a
  Scenario: The shell finds another
    Given a login shell whose startup files put a folder with another `specgate` first
    When `specgate compat run` prepares a run
    Then the run is not started, and its line says `compat_cli_not_under_exam` and where the other `specgate` is

  @REQ-749 @SCN-749b
  Scenario: The one under exam, by both roads
    Given a level with Specgate and a machine with `specgate` installed for every project
    When `specgate compat run` prepares a run
    Then both `specgate --version` in the login shell and `npx --no-install specgate --version` run the CLI under exam, and the run starts

  @REQ-749 @SCN-749c
  Scenario: The baseline reaches none
    Given level B on the same machine
    When `specgate compat run` prepares a run
    Then both roads answer that `specgate` is not found, and the run starts

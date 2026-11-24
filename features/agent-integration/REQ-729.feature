@change:opencode-plugin-v2
Feature: The exam runs OpenCode with a configuration of its own

  @REQ-729 @SCN-729a
  Scenario: Nothing of the Developer's
    Given XDG_CONFIG_HOME pointing at a folder with an opencode.json of the Developer's
    When the Developer runs `specgate compat run --tool opencode --level L0 --runs 1`
    Then OpenCode was started with XDG_CONFIG_HOME inside the run's own folder

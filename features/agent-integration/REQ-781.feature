@change:walkthrough-fixes-2
Feature: The Claude Code plugin, generated in a project, goes under .claude/

  @REQ-781 @SCN-781a
  Scenario: The next call goes through
    Given a Specgate project where `agents init --tool claude-plugin` ran, and a change open with no test yet
    When an agent's tool asks to run `ls`
    Then the plugin is under `.claude/specgate-plugin/`, nothing of it is at the root, and the call is allowed

Feature: The OpenCode plugin loads in OpenCode 2

  @REQ-727 @SCN-727a
  Scenario: The definition OpenCode 2 loads
    Given a project with no OpenCode plugin
    When the Developer runs `specgate agents init --tool opencode-plugin`
    Then `.opencode/plugins/specgate/index.js` exists, imports `Plugin` from `@opencode/plugin`, and default-exports `Plugin.define` with the id `specgate` and a setup function

  @REQ-727 @SCN-727b
  Scenario: The old plugin taken away
    Given a project with the `.opencode/plugin/specgate.js` an earlier Specgate generated
    When the Developer runs `specgate agents init --tool opencode-plugin`
    Then that file is gone and the new one is written

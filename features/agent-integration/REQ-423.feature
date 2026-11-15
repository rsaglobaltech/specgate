Feature: Installed once per user, quiet where there are no specs

  @REQ-423 @SCN-423a
  Scenario: One install, every repository
    Given a developer with two repositories, one spec-driven and one without `spec.md`
    When the developer runs `specgate agents install --global` and starts OpenCode in each
    Then the developer sees the plugin in OpenCode's global plugin folder
    And the guards working in the spec-driven repository and nothing from specgate in the other
    And a second run reports nothing changed

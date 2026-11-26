Feature: The plugin's hooks run as CommonJS in any project

  @REQ-790 @SCN-790a
  Scenario: A module project
    Given a project whose package.json says `"type": "module"`, and `agents init --tool claude-plugin`
    When the plugin's guard is asked to write `src/x.js` with no change open
    Then it refuses, exit 2, saying no change is open

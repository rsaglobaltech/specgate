Feature: The package carries the plugin manifests

  @REQ-550 @SCN-550a
  Scenario: A version bumped in one place
    Given the repository with `package.json` at a new version and the manifests at the old one
    When a maintainer runs the test suite, then `npm run plugin:sync`
    Then the suite fails naming each manifest that differs, and the sync writes the three manifests at the new version

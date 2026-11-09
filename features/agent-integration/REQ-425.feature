Feature: The plugin's version is the CLI's

  @REQ-425 @SCN-425a
  Scenario: A stale plugin manifest fails the build
    Given `package.json` at 0.28.0 and the shipped plugin manifest at 0.19.1
    When the maintainer runs `npm test`
    Then a test fails naming both versions and `specgate agents init --tool claude-plugin` as the fix

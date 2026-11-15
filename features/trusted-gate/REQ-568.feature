Feature: The public surface is frozen within a major version

  @REQ-568 @SCN-568a
  Scenario: A flag removed in a minor
    Given `contract/surface.json` frozen at 1.0.0 with `status --json`
    When a pull request for 1.1.0 removes `--json` from `status`
    Then `contract:check` fails, naming `flag:status --json` and that removing it waits for 2.0.0

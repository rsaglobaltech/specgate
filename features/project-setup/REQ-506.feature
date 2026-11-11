Feature: A catalog of every setting

  @REQ-506 @SCN-506a
  Scenario: The catalog of a project with one profile
    Given a project with `test_cmd: npm test` and the profile `fast` in `.harness/profiles.yaml`
    When a tool runs `specgate config keys --json`
    Then `test_cmd` has `current` `npm test` and `file` `harness.config.yaml`, `pet` has `values` `on` and `off` and `default` `on`, and both `profiles.<name>.agent` and `profiles.fast.agent` are listed with the file `.harness/profiles.yaml`

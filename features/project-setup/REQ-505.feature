Feature: config says the file each setting is kept in

  @REQ-505 @SCN-505a
  Scenario: test_cmd and pet
    Given a project where `specgate config set test_cmd "npm test"` and `specgate config set pet off` have run
    When a tool runs `specgate config list --json` and `specgate config get pet --json`
    Then the list has `files.test_cmd` `harness.config.yaml` and `files.pet` `.specgate/config.json`, and the get has `files.pet` `.specgate/config.json`

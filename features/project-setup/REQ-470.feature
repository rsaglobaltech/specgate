Feature: Adopt saves what it detects and says what is ready

  @REQ-470 @SCN-470a
  Scenario: A Node project adopted with --yes
    Given a local Node project whose package.json has a `test` script, and no specgate files
    When the developer runs `specgate adopt --yes`
    Then `harness.config.yaml` has `test_cmd: npm test`, `specgate check` runs `npm test`, and the readiness list shows the tests as set and the architecture check as not set with `specgate config set arch_cmd "<command>"`

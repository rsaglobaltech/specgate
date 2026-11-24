Feature: Every agent checked before it is used

  @REQ-690 @SCN-690a
  Scenario: One agent answers, one has an expired key
    Given the default agent answers OK, and careful's agent prints "This API key has expired" and exits 1
    When the Developer runs `specgate harness doctor --json`
    Then the default agent passes, careful's fails with "This API key has expired", the requirements of ausleihe name careful, and the doctor exits 1

  @REQ-690 @SCN-690b
  Scenario: Not installed
    Given a profile whose agent is `nosuchagent -p {prompt_file}`
    When the Developer runs `specgate harness doctor --no-probe --json`
    Then that agent fails as not installed, `nosuchagent` named, and no agent was run

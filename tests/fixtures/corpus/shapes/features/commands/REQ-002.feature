Feature: The quick check is named in the agent guide

  @REQ-002 @SCN-002a
  Scenario: The guide names the quick check
    Given a repository with the module billing
    When the developer generates the guide
    Then the developer sees `tool verify <module> --level fast` as the quick check, and `tool ci-log` for a red build

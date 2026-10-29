Feature: Linear is a built-in provider

  @REQ-308 @SCN-308a
  Scenario: The conformance suite against Linear
    Given `provider: linear`, `team_key: ENG` and `token_env: LINEAR_TOKEN` in `alm.config.yaml`
    When the ALM conformance suite runs against recorded Linear responses
    Then creating returns the issue identifier and its URL, a completed issue reads as done, a cancelled one as open, and closing writes a state change

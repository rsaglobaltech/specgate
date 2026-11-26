Feature: A setting, or a whole profile, removed with one command

  @REQ-707 @SCN-707a
  Scenario: careful removed
    Given the profile careful with an agent and a rule for ausleihe
    When the Developer runs `specgate config unset profiles.careful`
    Then .harness/profiles.yaml has no profile careful, and ausleihe's requirements go to the default agent

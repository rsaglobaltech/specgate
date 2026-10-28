Feature: The end checks run once the attempt checks pass

  @REQ-221 @SCN-221a
  Scenario: End after attempt
    Given an attempt check `marker` and an end check `final`
    When an attempt passes
    Then `marker` ran before `final`, and both passed

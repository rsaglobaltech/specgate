Feature: An agent that cannot run now gives way

  @REQ-586 @SCN-586a
  Scenario: Out of quota, with another agent configured
    Given `attempt_profiles: [claude, codex]` and claude out of quota on attempt 1
    When the harness meets the failure
    Then attempt 2 runs with codex instead of the run stopping

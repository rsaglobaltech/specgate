Feature: Only the findings a change adds fail the gate

  @REQ-222 @SCN-222a
  Scenario: Debt in the baseline passes, a new finding fails
    Given a check whose SARIF reports one finding in src/a.js, and a baseline taken with it
    When a second finding appears in src/a.js and the check runs
    Then it fails naming only the new one, as `src/a.js:<line> [rule] message`, and says one is in the baseline

  @REQ-222 @SCN-222b
  Scenario: Moved code is not new code
    Given the baselined finding's line moved two lines down, its text unchanged
    When the check runs
    Then it passes

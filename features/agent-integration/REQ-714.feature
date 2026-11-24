@change:harness-compat
Feature: Only the keys a run was given

  @REQ-714 @SCN-714a
  Scenario: The company key stays out
    Given OPENCODE_API_KEY set in the Developer's shell, and a fake opencode that prints whether it sees it
    When the Developer runs `specgate compat run --tool opencode --level L0 --runs 1`
    Then the fake opencode did not see OPENCODE_API_KEY

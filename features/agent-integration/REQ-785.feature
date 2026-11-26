Feature: A branch that changes no control is reported as changing none

  @REQ-785 @SCN-785a
  Scenario: Identical to main
    Given main with a sealed acceptance test, and a branch from it with no change
    When the developer runs `specgate check --base main`
    Then no `controls_changed_on_branch` is reported

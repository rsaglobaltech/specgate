Feature: A branch's changes to the controls are named for its reviewer

  @REQ-754 @SCN-754a
  Scenario: The guard switched off on a branch
    Given a branch of main whose `.specgate/config.json` switches the guard off
    When `specgate check --base main` runs
    Then it warns with `controls_changed_on_branch` that the guard was switched off, and the gate passes

  @REQ-754 @SCN-754b
  Scenario: The policy says error
    Given the same branch, and `controls: error` in `.specgate/gate.yaml` on main
    When `specgate check --base main` runs
    Then the gate fails with `controls_changed_on_branch`

  @REQ-754 @SCN-754c
  Scenario: An archived change, and a branch that changed nothing
    Given a branch of main that archived an approved change, and one that only changed the code
    When `specgate check --base main` runs on each
    Then neither is told of `controls_changed_on_branch`

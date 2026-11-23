Feature: The gate requires executable scenarios in every project

  @REQ-661 @SCN-661a
  Scenario: Required, no runner
    Given a project with `bdd: required`, no `bdd_cmd`, and draft-pedidos approved
    When the Developer runs `specgate check`
    Then the gate fails with `bdd_cmd_missing` naming draft-pedidos, whose fix names `specgate config set bdd_cmd`

  @REQ-661 @SCN-661b
  Scenario: An approved requirement without its feature
    Given a project with `bdd: required`, a `bdd_cmd`, and draft-pedidos approved whose `features/pedidos/REQ-031.feature` was deleted
    When the Developer runs `specgate check`
    Then the gate fails with `bdd_feature_missing` for REQ-031, whose fix is `specgate change features draft-pedidos`

  @REQ-661 @SCN-661c
  Scenario: Not set up yet
    Given a project adopted before, with no `bdd` in its gate.yaml
    When the Developer runs `specgate check`
    Then the gate warns `bdd_not_set_up` with `specgate migrate bdd`, and passes as it did

Feature: The migration leaves an open change's requirements to it

  @REQ-676 @SCN-676a
  Scenario: A requirement still in its change
    Given a hand-kept matrix with a row for REQ-020, stated in spec.md, and one for REQ-021, added by the open change draft-pedidos
    When the Developer runs `specgate matrix --migrate`
    Then the migration succeeds, spec.md has no section for REQ-021, and the output names draft-pedidos with `matrix_rows_in_changes`

  @REQ-676 @SCN-676b
  Scenario: A requirement an open change modifies
    Given a hand-kept matrix whose REQ-030 row lists the scenario SCN-030b that the open change draft-avisos adds to REQ-030, stated in a capability spec
    When the Developer runs `specgate matrix --migrate`
    Then the migration succeeds, REQ-030's row is the capability spec's, and the output names draft-avisos with `matrix_rows_in_changes`

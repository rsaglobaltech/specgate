Feature: The design carries its dependencies into the traces

  @REQ-390 @SCN-390a
  Scenario: The architect is told to carry a dependency into the trace
    Given a layered change panel
    When the architect runs `specgate change instructions design panel --json`
    Then one of the rules names `depends=`, `api=`, the `specgate:trace` under `specs/` and `layer_design_dependency_untraced`

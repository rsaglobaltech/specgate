Feature: The Design answers every acceptance criterion

  @REQ-285 @SCN-285a
  Scenario: A criterion the design forgot
    Given a Discover with `AC-1` and `AC-2`, and a design that answers only `AC-1`
    When `specgate change validate --strict` runs
    Then it exits 1 with `layer_design_misses_criterion` for `AC-2` and none for `AC-1`

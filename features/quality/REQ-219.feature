Feature: The checks run in the gate by stage

  @REQ-219 @SCN-219a
  Scenario: A failing gating check fails the gate
    Given a passing specification and a local check `lint` at attempt that exits 1
    When `specgate check` runs
    Then it fails naming lint, after the specification passed

  @REQ-219 @SCN-219b
  Scenario: An advisory check never fails it
    Given the same check with `gate: false`
    When `specgate check` runs
    Then the gate passes and the check's outcome is reported as failed

  @REQ-219 @SCN-219c
  Scenario: The ci stage runs only with --ci
    Given a check at the ci stage
    When `specgate check` runs, then `specgate check --ci`
    Then the first does not run it and the second does

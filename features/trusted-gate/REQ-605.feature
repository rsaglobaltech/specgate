Feature: The gate fails, reports or skips each rule as the policy says

  @REQ-605 @SCN-605a
  Scenario: Tdd reported, not failed
    Given a project where REQ-003 is Implemented with no test naming it, and `.specgate/gate.yaml` sets `tdd: warning`
    When the developer runs `specgate check`
    Then it exits 0, prints `Policy` with `tdd warning`, and its `--json` status carries `gate_rule_reported` and its validate stage `strict_tdd_1`, both as warnings

  @REQ-605 @SCN-605b
  Scenario: The flag still fails, and the date relaxes
    Given the same project
    When the developer runs `specgate validate . --strict --strict-tdd`, then sets the policy to `preset: strict` with `enforce_from: 2099-01-01` and runs `specgate validate . --strict`
    Then the first exits 1 and the second exits 0, saying errors are enforced from 2099-01-01

  @REQ-605 @SCN-605c
  Scenario: No policy, the gate as it was
    Given the same project with no `.specgate/gate.yaml`
    When the developer runs `specgate check`
    Then it exits 1 with `check_validate_failed`, and prints no `Policy` line

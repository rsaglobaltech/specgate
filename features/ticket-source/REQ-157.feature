Feature: A change reserves its scenario ids as it reserves its requirement ids

  @REQ-157 @SCN-157a
  Scenario: Two tickets opened before either is drafted
    Given a project where KAN-14's change was opened with `scn_range: [SCN-002, SCN-019]` and not yet drafted
    When the developer opens KAN-13 with `specgate propose --from-ticket KAN-13.json --capability parking`
    Then KAN-13's `change.yaml` has a `scn_range` starting at SCN-020, and its `DRAFTING.md` names that range

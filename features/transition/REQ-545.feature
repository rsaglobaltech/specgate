Feature: A change says whether it is a bug or an enhancement

  @REQ-545 @SCN-545a
  Scenario: A bug from the command line
    Given a specgate project
    When a tool runs `specgate propose rounding --kind bug`, then `specgate propose other --kind chore`
    Then `docs/specs/changes/rounding/change.yaml` has `kind: bug`, and the second is refused with `change_kind_unknown`

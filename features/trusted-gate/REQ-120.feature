Feature: An id taken on the base branch is refused before merge

  @REQ-120 @SCN-120a
  Scenario: Two branches, one id
    Given a base branch `develop` whose capability spec declares REQ-003 "Export orders as CSV", and a branch whose open change adds REQ-003 "Refund an order"
    When the developer runs `specgate check --base develop` on the branch
    Then the gate fails with `id_taken_on_base`, the message names both titles, and the fix names the next id free on both sides
    And the same requirement with the same title on both sides is not a collision

  @REQ-120 @SCN-120b
  Scenario: No base to compare with
    Given a project with no git repository
    When the developer runs `specgate check`
    Then the gate does not fail for ids, and says the base comparison was skipped

  @REQ-120 @SCN-120c
  Scenario: A gitflow project compares with develop
    Given a clone whose remote's default branch is `main`, an `alm.config.yaml` with `pr: base: develop`, and a `develop` branch that declares REQ-003 "Export orders as CSV"
    When the developer runs `specgate check` with no `--base` on a branch whose open change adds REQ-003 "Refund an order"
    Then the gate fails with `id_taken_on_base` and says the ids were compared with `develop`

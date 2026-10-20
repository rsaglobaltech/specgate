Feature: New ids are free on every branch, not only this one

  @REQ-152 @SCN-152a
  Scenario: Two tickets, two branches
    Given a repository whose branch `feature/KAN-14-vehicle-type-catalog` holds a change reserving REQ-002 to REQ-005 with scenarios SCN-002 to SCN-006, and the developer is on `develop`, which has none of them
    When the developer runs `specgate propose --from-ticket KAN-13.json --capability parking`
    Then the change `kan-13-register-vehicle-entry` reserves ids from REQ-006 up, and its `DRAFTING.md` starts scenarios at SCN-007

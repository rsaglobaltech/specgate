Feature: Modifying a delivered requirement starts from its text

  @REQ-190 @SCN-190a
  Scenario: The requirement copied, reopened alone
    Given capability fichas defines REQ-017 as Implemented with scenarios SCN-048 to SCN-050
    When `specgate change new gears --modify REQ-017` runs
    Then the change's fichas delta has REQ-017 under MODIFIED with its statement, SCN-048 to SCN-050 and status Draft, and no other requirement of fichas changes status

  @REQ-190 @SCN-190b
  Scenario: What cannot be modified is refused
    Given REQ-999 is defined nowhere and change gears already modifies REQ-017
    When `specgate change new other --modify REQ-999` or `--modify REQ-017` runs
    Then it is refused, saying REQ-999 is not in a capability spec, or that gears already modifies REQ-017

Feature: Archive closes the change's evidence

  @REQ-813 @SCN-813a
  Scenario: The page goes with the change
    Given draft-orders, whose REQ-031 is Implemented with a before and an after, in a project with `bdd: required`
    When the Developer runs `specgate archive draft-orders`
    Then the archived change holds EVIDENCE.md with REQ-031's section

  @REQ-813 @SCN-813b
  Scenario: No before, required
    Given the same change with REQ-032 Implemented with no before, and `evidence: required`
    When the Developer runs `specgate archive draft-orders`
    Then it is refused with `archive_no_before` naming REQ-032; with `--force` it is archived

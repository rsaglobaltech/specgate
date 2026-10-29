Feature: One sub-issue per repository of a change

  @REQ-307 @SCN-307a
  Scenario: A change across three repositories
    Given the change `follow-shipment` with `ticket: FLEET-20` and `repositories: [fleet, tracking, web]`
    When `specgate alm sync` runs twice
    Then three sub-issues of FLEET-20 exist, one per repository, and the second run creates none

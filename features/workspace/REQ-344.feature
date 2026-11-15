Feature: The story's other repositories, named to each

  @REQ-344 @SCN-344a
  Scenario: Tracking is told of fleet
    Given follow-shipment split across fleet and tracking, fleet's part adding REQ-003
    When the developer proposes it and runs `specgate workspace harness run --story follow-shipment --dry-run --json`, then `specgate harness prompt REQ-005` in tracking with that context
    Then tracking's `discover.md` names fleet, its `design.md` says `depends=fleet:REQ-NNN`, its run's context names fleet:REQ-003, and the prompt includes it

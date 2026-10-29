Feature: A repository waiting on another's requirement is built after it

  @REQ-345 @SCN-345a
  Scenario: Tracking waits on fleet
    Given follow-shipment across fleet and tracking, tracking's REQ-005 with `depends=fleet:REQ-003`, fleet's REQ-003 not delivered
    When the developer runs `specgate workspace harness run --story follow-shipment --dry-run --json`
    Then fleet is in level 1 and tracking in level 2

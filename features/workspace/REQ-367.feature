Feature: A requirement waits for what it depends on

  @REQ-367 @SCN-367a
  Scenario: tracking's REQ-005 waits on fleet's REQ-003, which fails
    Given follow-shipment where tracking's REQ-005 depends on fleet's REQ-003 and tracking's REQ-006 depends on nothing, and fleet's harness does not deliver REQ-003
    When the developer runs `specgate workspace harness run --story follow-shipment`
    Then tracking's harness is started for REQ-006 only, REQ-005 is reported waiting on fleet:REQ-003, and the run exits 1

Feature: Whoever writes a part of a story hears of the others

  @REQ-366 @SCN-366a
  Scenario: tracking's delta is written after fleet's
    Given follow-shipment split across fleet and tracking, fleet's part adding REQ-003
    When the developer runs `specgate change author follow-shipment --artifact specs --dry-run` in tracking
    Then the prompt names fleet:REQ-003 and `depends=`

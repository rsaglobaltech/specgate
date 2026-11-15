Feature: The business layer Specgate writes reads as business

  @REQ-365 @SCN-365a
  Scenario: follow-shipment proposed with a contracts repository
    Given a workspace with fleet, tracking and a contracts repository, and follow-shipment drafted
    When the developer proposes it and runs `specgate change validate follow-shipment --json` in fleet
    Then no `layer_discover_technical` is reported, and fleet's `design.md` says how to write `depends=` and `api=`

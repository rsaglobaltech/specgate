Feature: A story's parts, building and blocked

  @REQ-321 @SCN-321a
  Scenario: Tracking builds, and waits on fleet
    Given the story follow-shipment across fleet and tracking, whose tracking delta adds REQ-005 with `depends=fleet:REQ-000`, fleet's REQ-000 still Draft, and harness events for REQ-005
    When the developer runs `specgate workspace live --json`
    Then follow-shipment's tracking part is building and blocked by fleet:REQ-000, and its fleet part is open

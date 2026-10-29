Feature: A story's cost counts its delivered parts

  @REQ-347 @SCN-347a
  Scenario: Fleet's part archived after two minutes
    Given follow-shipment whose fleet part, REQ-003, is archived and whose fleet ledger records REQ-003 for 120 seconds
    When the developer runs `specgate workspace live --json`
    Then the story's cost is 2 minutes

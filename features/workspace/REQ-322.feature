Feature: What each repository and each story has cost

  @REQ-322 @SCN-322a
  Scenario: Tracking's REQ-005 cost 0.42 and 2 minutes
    Given tracking's harness ledger records REQ-005 for 120000 ms and its events report a cost of 0.42
    When the developer runs `specgate workspace live --json`
    Then tracking's cost is 0.42 and 2 minutes, and the story follow-shipment's cost is 0.42 and 2 minutes

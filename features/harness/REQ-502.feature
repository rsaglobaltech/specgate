Feature: The harness report for one capability

  @REQ-502 @SCN-502a
  Scenario: Two runs over two capabilities
    Given a project whose REQ-002 is in the capability `orders` and REQ-003 in `billing`, and a recorded run where REQ-002 passed and REQ-003 failed
    When a tool runs `specgate harness report --json --capability orders`
    Then `report.capability` is `orders`, one requirement was attempted and it passed

Feature: The workspace check judges the code as the harness does

  @REQ-419 @SCN-419a
  Scenario: Tracking serves the path in Spring pieces
    Given contracts' REQ-002 cites its own `getTachograph`, delivered, and tracking's REQ-002 cites `api=contracts:contracts/fleet.openapi.yaml#getTachograph`, delivered
    When tracking's controller has a prefix on the class and the rest of the operation's path on the method; then drops the last segment
    Then `workspace check` reports no `contract_operation_not_found` the first time, and one naming tracking's REQ-002 the second; contracts is never named

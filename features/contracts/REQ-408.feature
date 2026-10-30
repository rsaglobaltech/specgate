Feature: The operation is in the code

  @REQ-408 @SCN-408a
  Scenario: Tracking serves a path of its own
    Given tracking's REQ-002, Implemented, cites the contract's tachograph operation `getTachograph`, whose path has a vehicle parameter
    When tracking's code serves that path under `/api` with `:vehicleId`, and then only a path of its own under `/api/fleet/trucks`
    Then `workspace check` warns nothing about it the first time, and `contract_operation_not_found` naming tracking:REQ-002 and the operation's method and path the second

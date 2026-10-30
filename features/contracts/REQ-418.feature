Feature: The code serves or calls the operation it cites

  @REQ-418 @SCN-418a
  Scenario: Tracking passes its tests and serves no route of the contract
    Given tracking's REQ-002 cites `api=contracts:contracts/tracking-api.yaml#getTruckStatus`, whose path has a truck parameter
    When tracking's controller serves no such path; then serves the operation's path whole; then splits it, a prefix on the class and the rest on the method; then drops its last segment
    Then the check names `contract_operation_not_found` and the operation's method and path the first and last time, and nothing the second and third; the contracts repository, citing its own operations, is not checked

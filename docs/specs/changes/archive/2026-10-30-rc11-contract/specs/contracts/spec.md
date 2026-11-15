# Delta — contracts

## ADDED Requirements

### Requirement: REQ-419 — The workspace check judges the code as the harness does

The system SHALL apply in `workspace check` the rule of REQ-418 to `contract_operation_not_found`: a path in pieces, with every literal segment in a quoted string of one file, counts as served or called, and a member whose role is `contracts` is not checked against its own operations.

#### Scenario: SCN-419a — Tracking serves the path in Spring pieces

- GIVEN contracts' REQ-002 cites its own `getTachograph`, delivered, and tracking's REQ-002 cites `api=contracts:contracts/fleet.openapi.yaml#getTachograph`, delivered
- WHEN tracking's controller has a prefix on the class and the rest of the operation's path on the method; then drops the last segment
- THEN `workspace check` reports no `contract_operation_not_found` the first time, and one naming tracking's REQ-002 the second; contracts is never named

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/contracts/REQ-419.feature test=tests/unit/rc9-contract.test.ts -->

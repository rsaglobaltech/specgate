# Delta — fees

## ADDED Requirements

### Requirement: REQ-003 — The cap depends on the member

The system SHALL accept the member's type as the second argument of `lateFee(daysLate, memberType)` and cap the fee at 5.00 for a `"child"` member and at 10.00 for any other, a call without the type behaving as before.

#### Scenario: SCN-003a — A child's cap

- GIVEN a child member's book returned 30 days late
- WHEN the fee is computed
- THEN the fee is 5.00

#### Scenario: SCN-003b — An adult's cap is unchanged

- GIVEN an adult member's book returned 30 days late
- WHEN the fee is computed
- THEN the fee is 10.00

<!-- specgate:trace kind=functional actor=Developer -->

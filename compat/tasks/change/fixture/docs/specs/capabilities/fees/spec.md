# Fees

## Requirements

### Requirement: REQ-002 — Late fee

The system SHALL export `lateFee(daysLate)` from `src/fees.js`, returning the fee in euros for a book returned `daysLate` days late: 0 when it is not late, 0.50 per late day, and never more than 10.00.

#### Scenario: SCN-002a — Three days late

- GIVEN a book returned 3 days late
- WHEN the fee is computed
- THEN the fee is 1.50

#### Scenario: SCN-002b — The cap

- GIVEN a book returned 30 days late
- WHEN the fee is computed
- THEN the fee is 10.00

<!-- specgate:trace actor=Developer feature=features/fees/REQ-002.feature kind=functional status=Implemented -->

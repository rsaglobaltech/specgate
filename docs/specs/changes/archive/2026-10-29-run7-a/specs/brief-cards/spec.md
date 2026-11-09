# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-277 — D6 reads a date or a time as one value

The system SHALL read, in a scenario step, an ISO date (`2026-10-29`), a time (`10:00:00`, `07:42`) and a date-time (`2026-10-29 10:00:00`, `2026-10-29T10:00:00Z`) as one stated value each, never as the numbers inside them.

#### Scenario: SCN-277a — A position with its time

- GIVEN the step "GIVEN truck TRK-001 last reported 45.7640, 4.8357 at 2026-10-29 10:00:00"
- WHEN D6 reads its values
- THEN they are 45.7640, 4.8357 and 2026-10-29 10:00:00, and none is 29 or 00

<!-- specgate:trace status=Implemented test=tests/unit/draft-checklist.test.ts actor=Developer kind=functional -->

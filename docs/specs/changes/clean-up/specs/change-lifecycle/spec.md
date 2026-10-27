# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-202 — Only defined ids reserve the next ones

The system SHALL take the highest reserved requirement id, on this branch and on others, only from the lines that define or reserve one — a heading, a matrix row's first cells, a `req_range` — and not from a mention in a requirement's or scenario's text.

#### Scenario: SCN-202a — A mention in a scenario reserves nothing

- GIVEN the highest requirement is REQ-018 and a scenario says "GIVEN REQ-999 is defined nowhere"
- WHEN a change reserves two ids
- THEN it gets REQ-019 and REQ-020

<!-- specgate:trace status=Implemented test=tests/unit/change-evolution.test.ts actor=Developer kind=functional -->

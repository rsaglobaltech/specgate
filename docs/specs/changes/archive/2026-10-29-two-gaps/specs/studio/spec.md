# Delta — studio

## ADDED Requirements

### Requirement: REQ-304 — The report shows the two gaps

The system SHALL show in the studio's report the share of built requirements with each gap — spec → implementation and intent → spec — as `harness report` computes them, and nothing when the ledger records no requirement.

#### Scenario: SCN-304a — A report after two runs

- GIVEN a project whose ledger records REQ-002, rejected at `quality check: pmd` and then passed, and REQ-003, passed at once
- WHEN the studio's report is read
- THEN it gives spec → implementation 50 % and intent → spec 0 %

<!-- specgate:trace status=Implemented test=tests/unit/harness-gaps.test.ts actor=Developer kind=functional -->

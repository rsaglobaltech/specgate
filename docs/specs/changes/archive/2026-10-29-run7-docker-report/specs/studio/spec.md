# Delta — studio

## ADDED Requirements

### Requirement: REQ-280 — The report titles a scenario from the specification

The system SHALL take the title of each scenario in the studio's report from the specification only — `spec.md`, the capability specs and the deltas of open changes, a delta first — and never from a draft's `DRAFTING.md`, a proposal, or an archived change.

#### Scenario: SCN-280a — A delivered requirement of a draft

- GIVEN REQ-002 is in the open change `draft-fleet-tracking`, whose delta names `SCN-002 — A registered tracker reports a position` and whose `DRAFTING.md` shows `SCN-002 — <what happens>`
- WHEN the studio's report lists REQ-002's scenarios
- THEN SCN-002 is titled "A registered tracker reports a position"

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/harness-run7.test.ts -->

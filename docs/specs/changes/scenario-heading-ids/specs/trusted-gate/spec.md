# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-483 — A requirement id in a scenario's title declares nothing

The system SHALL read a requirement as declared only from a requirement heading or a requirement table row, never from a scenario heading: an id a scenario's title names — "#### Scenario: SCN-252 — Apply on REQ-030 in the browser" — is not a requirement of the spec, and `validate --strict` asks no matrix row for it.

#### Scenario: SCN-483a — A scenario that names another requirement

- GIVEN a change whose delta declares REQ-086 with the scenario "#### Scenario: SCN-252 — Apply on REQ-030 in the browser", and no REQ-030 anywhere else
- WHEN the developer runs `specgate validate . --strict`
- THEN it reports no TDD-3 finding for REQ-030, and REQ-086 is still declared

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

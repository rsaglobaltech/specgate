# Delta — studio

## ADDED Requirements

### Requirement: REQ-270 — The studio's report judges the project as check does

The system SHALL judge the specification gate of the studio's report against the project as it will be after its open changes are archived, as `specgate check` does, so a requirement of a reviewed draft that the harness delivered — its feature file written, its row not yet in the written matrix — does not make the report fail.

#### Scenario: SCN-270a — A draft's requirement delivered before the draft is archived

- GIVEN REQ-002 is only in the open change `draft-flota`, and `features/flota/REQ-002.feature` is written
- WHEN the studio's report runs its specification gate
- THEN the gate passes, while the bare `validate --strict` still names the feature missing from the matrix

<!-- specgate:trace status=Implemented test=tests/unit/studio-inflight.test.ts actor=Developer kind=functional -->

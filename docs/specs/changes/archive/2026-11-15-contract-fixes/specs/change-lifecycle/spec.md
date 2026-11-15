# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-564 — change show says whether the change may be built

The system SHALL include in `specgate change show <id> --json` the change's approvals as the harness judges them — whether they are required, whether the change is approved, when, and each layer's approvals and quorum — so a tool never takes `change.yaml`'s `approved:` line, which outlives an edit of an approved layer, for the answer.

#### Scenario: SCN-564a — A change just proposed

- GIVEN a change just proposed, with its three layers and no approval
- WHEN a tool runs `specgate change show <id> --json`
- THEN `change.approvals.approved` is false and `change.approvals.layers` lists discover, design and tasks

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-564.feature actor=Developer kind=functional -->

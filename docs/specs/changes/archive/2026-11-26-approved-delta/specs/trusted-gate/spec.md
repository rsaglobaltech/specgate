# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-739 — Approving a change seals each of its requirements

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-739.feature actor=Developer kind=functional -->

The system SHALL, on `specgate change approve <id>`, record for each requirement of the change's delta a seal of its heading, its statement and its scenarios — the `specgate:trace` comment left out —, at every rigor, a change of lite rigor with nothing written in its layers included.

> Found on 2026-11-24: an approval remembered the discover, the design and the tasks, and not the requirements; at lite rigor, a date.

#### Scenario: SCN-739a — Sealed at lite rigor

- GIVEN draft-pedidos of lite rigor with REQ-031 and nothing written in its layers
- WHEN the Developer runs `specgate change approve draft-pedidos`
- THEN approvals.json has a seal for REQ-031

#### Scenario: SCN-739b — Delivering is not changing

- GIVEN draft-pedidos approved with REQ-031 sealed
- WHEN `specgate apply REQ-031` writes its status in the delta
- THEN REQ-031's seal still matches, and the gate says nothing of it

### Requirement: REQ-740 — The gate fails when an approved requirement changed

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-740.feature actor=Developer kind=functional -->

The system SHALL fail `specgate validate --strict` — and so `check`, `apply` and the harness gate — with `approved_requirement_changed` for each requirement of an approved change whose statement or scenarios differ from its seal, that was added after the approval, or that was sealed and is gone, naming the requirement and which of the three, whose fix is to approve the change again; and SHALL pass once it is approved again.

> Measured on 2026-11-24: an approved requirement rewritten from "0.50 a day, at most 10.00" to "1.00 a day, at most 20.00", and `specgate check` passed.

#### Scenario: SCN-740a — A requirement rewritten after approval

- GIVEN draft-pedidos approved, then REQ-031's statement changed to let a shipped order be cancelled
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `approved_requirement_changed` naming REQ-031 as changed, whose fix is `specgate change approve draft-pedidos`

#### Scenario: SCN-740b — A scenario loosened

- GIVEN draft-pedidos approved, then SCN-032's THEN changed from "is not cancelled" to "is cancelled"
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `approved_requirement_changed` naming REQ-031

#### Scenario: SCN-740c — Approved again

- GIVEN the same change after its requirement was rewritten
- WHEN the Developer runs `specgate change approve draft-pedidos` and then `specgate check`
- THEN the finding is gone

#### Scenario: SCN-740d — A requirement slipped in

- GIVEN draft-pedidos approved, then REQ-032 added to its delta
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `approved_requirement_changed` naming REQ-032 as added after the approval

### Requirement: REQ-741 — A change approved before seals existed is said to be unsealed

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-741.feature actor=Developer kind=functional -->

The system SHALL, for a change approved with no seals recorded, warn `approval_not_sealed` naming the change, whose fix is `specgate change approve <id>`, and pass the gate as it did.

> Every project approved its changes before this: they are not broken by it.

#### Scenario: SCN-741a — Approved by an earlier Specgate

- GIVEN draft-pedidos approved with only `approved: 2026-11-01` in its change.yaml
- WHEN the Developer runs `specgate check`
- THEN the gate passes with the warning `approval_not_sealed` naming draft-pedidos

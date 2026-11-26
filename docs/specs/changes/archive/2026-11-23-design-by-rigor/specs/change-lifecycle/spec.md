# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-599 — The design layer, by the change's rigor

The system SHALL judge whether design.md answers each acceptance criterion only once the design is written, and without the lines it shares with its template; SHALL, for a change at `rigor: full`, warn `layer_design_not_written` while design.md is as scaffolded and not count the change approved — so the harness does not build it — until its design is written and approved; and SHALL, at `rigor: lite`, treat an unwritten design as skipped, neither asking for it in status nor waiting for it.

#### Scenario: SCN-599a — The template answers nothing

- GIVEN a change whose Discover lists AC-1 and AC-2, and whose design.md is the template plus a line answering AC-2
- WHEN the change is validated
- THEN design.md is said not to answer AC-1, and AC-2 is answered

#### Scenario: SCN-599b — Lite: no design owed

- GIVEN a change at rigor lite whose design.md is as scaffolded
- WHEN the change is validated and its status read
- THEN no design finding is given, and the design is skipped

#### Scenario: SCN-599c — Full: the design is owed

- GIVEN a change at rigor full whose design.md is as scaffolded
- WHEN the change is validated and its approvals read
- THEN layer_design_not_written is given, and the change is not approved: its design is not written

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-599.feature actor=Developer kind=functional -->

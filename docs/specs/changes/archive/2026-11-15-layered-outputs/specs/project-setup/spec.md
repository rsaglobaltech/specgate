# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-561 — A reversed module is a layered change

The system SHALL write the change `specgate reverse <module>` drafts in the three layers (ADR-0044): `discover.md` saying what was read and the criteria a person confirms, `design.md` naming the module, `tasks.md` with one task per drafted requirement naming it, and `schema: layered` — and SHALL write no `proposal.md`; the change SHALL pass `specgate change validate --strict`.

#### Scenario: SCN-561a — A reversed module is a layered change

- GIVEN a Maven project whose module `orders` an agent reads into two requirements
- WHEN a developer runs `specgate reverse orders`
- THEN the change has discover.md, design.md and tasks.md naming both requirements, `schema: layered`, no proposal.md, and `change validate --strict` passes

<!-- specgate:trace status=Implemented feature=features/project-setup/REQ-561.feature actor=Developer kind=functional -->

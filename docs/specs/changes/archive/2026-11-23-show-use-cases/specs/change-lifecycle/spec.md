# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-628 — `change show --json` carries the change's use cases

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-628.feature actor=Developer kind=functional -->

The system SHALL answer, in `change show <id> --json`, `change.useCases`: the use cases the change's `use-cases.md` adds and modifies — each with its id, name, actor and requirements — and removes, each with its reason; and `null` when the change has no `use-cases.md`; so that a client shows them without reading the file.

#### Scenario: SCN-628a — A change's use cases shown

- GIVEN a change whose use-cases.md adds UC-004 "Create a child profile" for Tutor with REQ-001 and REQ-002, and removes UC-002 "Merged into UC-004"
- WHEN a client runs `specgate change show <id> --json`
- THEN `change.useCases` has UC-004 with its name, actor and requirements under added, nothing under modified, and UC-002 with its reason under removed; a change with no use-cases.md has `null`

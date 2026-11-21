# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-646 — status --json carries what an open change proposes, before archive

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

The system SHALL carry in `status --json`, besides the catalog's use cases, `useCases.proposed`: each use case an open change's `use-cases.md` adds or modifies — with its change, whether it is added or modified, its specification from the change's `use-cases/UC-NNN.md` and its activity, or none — and SHALL carry in `stateMachines` each machine an open change writes, as the change's delta leaves it, naming the change in `proposed` (null for a machine of `docs/specs/state-machines/`); an archived change proposes nothing.

> The Reviewer approved draft-cuenta-perfiles and saw "no use cases yet": archive brings them into the catalog only once every requirement is delivered.

#### Scenario: SCN-646a — Proposed before archive

- GIVEN a catalog with only the template, and the open change draft-cuenta-perfiles adding UC-002 with its specification and UC-003 without one, and writing Cuenta's machine
- WHEN the Developer runs `specgate status --json`
- THEN useCases.proposed lists UC-002 and UC-003 of draft-cuenta-perfiles as added, UC-002 with its specification's lanes and activity; stateMachines lists Cuenta proposed by draft-cuenta-perfiles

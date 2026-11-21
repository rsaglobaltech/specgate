# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-634 — The use-case diagram and each use case's activity diagram are generated

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-634.feature actor=Developer kind=functional -->

The system SHALL generate, from `docs/specs/use-cases.md` and each `docs/specs/use-cases/UC-NNN.md`, `docs/specs/use-case-diagrams.md` — in Mermaid: each actor linked to the use cases it achieves inside the system, by id, and for each use case with a specification its activity, the main flow's steps in order from start to end, labelled with its scenarios, and each alternative branching at its step and ending — and `docs/specs/use-cases.puml`, the same diagrams in PlantUML; SHALL write them when `check` or `archive` regenerates the diagrams, the same bytes for the same sources; SHALL report `use_case_diagrams_stale` for a committed copy that differs; and SHALL draw nothing for a catalog holding only the template's row.

> #544: a use-case diagram with a live preview, and an activity diagram from the flows — generated so it never drifts from the catalog; Mermaid to render without a server, PlantUML for a team that draws with it.

#### Scenario: SCN-634a — The Mermaid diagrams

- GIVEN UC-002 and UC-004 for Tutor, and UC-004's specification with three steps and A1 at step 3 naming SCN-013
- WHEN specgate generates the diagrams
- THEN use-case-diagrams.md links Tutor to UC-002 and UC-004 in order, and UC-004's activity runs start → steps → end labelled SCN-012, with A1 branching from step 3 to the end

#### Scenario: SCN-634b — The PlantUML export

- GIVEN the same use cases and specification
- WHEN specgate generates the diagrams
- THEN use-cases.puml has the actor, the use cases inside System and their links, and UC-004's activity with A1 as a branch at step 3

#### Scenario: SCN-634c — Regenerated, and a hand edit reported

- GIVEN a project with UC-004 and its specification
- WHEN the diagrams are regenerated, and then use-cases.puml is edited by hand
- THEN both files are written once, nothing the second time, and `use_case_diagrams_stale` names use-cases.puml

### Requirement: REQ-635 — `status --json` carries the use cases, their specifications and diagrams

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-635.feature actor=Developer kind=functional -->

The system SHALL answer, in `status --json`, `useCases`: the use-case diagram in Mermaid, and each use case of the catalog with its id, name, actor, requirements, its specification's file, the specification as read (REQ-631) and its activity in Mermaid — the last three null for a use case with no specification — and `null` for a project with no `docs/specs/use-cases.md`; so that a client shows them without reading the files.

#### Scenario: SCN-635a — The use cases in status

- GIVEN a project with UC-004 in the catalog and its specification naming SCN-012
- WHEN a client runs `specgate status --json`
- THEN `useCases.diagram` is a Mermaid flowchart, and UC-004 carries docs/specs/use-cases/UC-004.md, its main flow naming SCN-012 and its activity; with no catalog, `useCases` is null

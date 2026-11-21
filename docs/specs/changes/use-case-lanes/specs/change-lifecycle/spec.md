# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-640 — Each step of a use case says who does it

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

The system SHALL read a step of a use case's specification written `<n>. [<Who>] <text>` as done by `<Who>`, and a step with no tag as done by the use case's first actor — its text without the tag — and SHALL refuse, wherever REQ-631 checks a specification (archive, and a draft's D15), a step done by someone not listed under `## Actors` (`ucs_unknown_lane`).

> The Reviewer chose, instead of BPMN, the use case's activity with a lane per actor, as UML tools draw it.

#### Scenario: SCN-640a — Lanes read

- GIVEN UC-007 with Child, PintaMundo and Safety service as actors, steps tagged [Child], untagged, [PintaMundo], [Safety service], [PintaMundo], and A1 tagged [PintaMundo]
- WHEN specgate reads it
- THEN the main flow's lanes are Child, Child, PintaMundo, Safety service and PintaMundo, A1's is PintaMundo, the steps keep no tag, and there is nothing to fix

#### Scenario: SCN-640b — A lane no actor names

- GIVEN the same specification with step 4 tagged [Moderator]
- WHEN specgate checks it
- THEN it names ucs_unknown_lane for Moderator

### Requirement: REQ-641 — A use case's activity is drawn with a lane per actor

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

The system SHALL draw a use case's activity — in `docs/specs/use-case-diagrams.md` (Mermaid) and `docs/specs/use-cases.puml` (PlantUML) — with a lane per actor when its steps are done by more than one, each step inside its own lane, the flows and alternatives as before; and as before, with no lanes, when one actor does them all.

#### Scenario: SCN-641a — Lanes in Mermaid

- GIVEN UC-007's specification
- WHEN specgate draws its activity in Mermaid
- THEN it has a subgraph for Child holding steps 1 and 2, one for Safety service holding step 4, and one for PintaMundo holding A1's step

#### Scenario: SCN-641b — Lanes in PlantUML

- GIVEN UC-007's specification
- WHEN specgate writes its activity in PlantUML
- THEN it starts in |Child| and switches to |PintaMundo| and |Safety service| where the steps do, A1's step under |PintaMundo|

### Requirement: REQ-642 — The lanes reach the agent that drafts and the studio

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

The system SHALL tell the agent, in `DRAFTING.md`, to start a step with `[Who]` when someone other than the first actor does it and to list everyone under Actors; and SHALL carry each flow's `lanes`, beside its steps, in `status --json`.

#### Scenario: SCN-642a — The guide asks for it

- GIVEN a brief with the module bookings
- WHEN the Developer runs `specgate draft bookings`
- THEN DRAFTING.md says to start a step with `[Who]`, its example has a step tagged [System] and System among the actors

#### Scenario: SCN-642b — Carried to the studio

- GIVEN UC-004 with Tutor and System, step 2 tagged [System]
- WHEN the Developer runs `specgate status --json`
- THEN its main flow's lanes are Tutor and System, its steps keep no tag, and its activity has System's lane

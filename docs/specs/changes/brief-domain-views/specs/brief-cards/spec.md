# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-658 — The project's domain model, to draw

<!-- specgate:trace status=Implemented feature=features/brief-cards/REQ-658.feature actor=Developer kind=functional -->

The system SHALL answer, on `specgate brief model --json`, the project's domain model as its bounded contexts — each with its purpose, classification, integrations with their relationships and messages, terms, rules, flows (actor, command or policy with its trigger, outcomes, systems, views, and how it was placed), stories (numbered activities) and questions — read from the workshop's models in `docs/brief/models` when there are any; and, when there are none, from the specification: each capability or draft's module a context, each requirement a flow whose command is its title, whose actor is its trace's and whose outcomes are its scenarios, and each use case with a specification a story of its main flow's steps; and SHALL say which of the two it was read from.

> The studio draws the brief as DDD diagrams — a context map and each context's flows as an Event Storming — whether the project came from a workshop or not (issue #59, both ways).

#### Scenario: SCN-658a — From the claims workshop

- GIVEN a project where the motor-claims workshop was imported
- WHEN the Developer runs `specgate brief model --json`
- THEN it answers `source: workshop` and three contexts, siniestros core with its outbound ACL to Pólizas "Consultar cobertura", its flow "Asegurado · Declarar siniestro · Siniestro declarado", and its story of 26 activities, the first by the Asegurado

#### Scenario: SCN-658b — From the specification, with no workshop

- GIVEN a project with no workshop, a module pedidos whose draft has REQ-031 "Cancel an order" by the Customer with the scenario "Cancelled before shipping", and the use case UC-001 whose main flow has three steps
- WHEN the Developer runs `specgate brief model --json`
- THEN it answers `source: spec`, the context pedidos with the flow "Customer · Cancel an order · Cancelled before shipping", and the story of UC-001 with its three steps

### Requirement: REQ-659 — The domain model exported to DDD Toolbox

<!-- specgate:trace status=Implemented feature=features/brief-cards/REQ-659.feature actor=Developer kind=functional -->

The system SHALL, on `specgate brief export [--out <dir>]`, write the project's domain model as boards DDD Toolbox opens — a Bounded Context Canvas per context, an Event Storming board of every flow along the timeline, and a Domain Storytelling board per story — in its exported file format and none of its code, under `docs/brief/ddd-toolbox` unless `--out` names another folder, and answer with `--json` the files written; boards read back by `brief import` SHALL give the same contexts, flows and stories.

#### Scenario: SCN-659a — The claims workshop, there and back

- GIVEN the claims workshop imported
- WHEN the Developer runs `specgate brief export` and imports the boards it wrote into an empty project
- THEN the three canvases, the Event Storming board and the story are written, and read back they give the same three contexts, 26 flows and the 26 activities in order

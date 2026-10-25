# Delta — live-harness

## ADDED Requirements

### Requirement: REQ-179 — The live view reads like a CI run

The system SHALL give each requirement of the live model its title and module from the specification (an open change's delta or a capability spec, never a DRAFTING.md example), and SHALL lay `/live` out as a sidebar of the run's requirements by module with status and duration, a summary of the run, a graph of its requirements in the order they ran, and the steps of the selected requirement — Agent, each gate stage, the stages still to come — with the agent's stream as the log of the step in progress; self-contained, every value set as text, in light and dark.

#### Scenario: SCN-179a — Titles and modules in the live model

- GIVEN a project whose open change draft-diario defines REQ-022 "Registrar una clase con su fecha", whose DRAFTING.md shows an example REQ-022 "<a short name>", and harness events for REQ-022
- WHEN the live model is read
- THEN REQ-022 has the title "Registrar una clase con su fecha" and the module "diario"

#### Scenario: SCN-179b — The page is laid out as a CI run

- GIVEN the live page
- WHEN it is served
- THEN it has the sidebar of requirements, the run's summary, the graph of jobs, the steps Agent, Specification, Architecture, Tests and Merge, and the log, loads nothing from another host and parses nothing from an event as HTML

<!-- specgate:trace status=Draft test=tests/unit/live-view-polish.test.ts actor=Developer kind=functional -->

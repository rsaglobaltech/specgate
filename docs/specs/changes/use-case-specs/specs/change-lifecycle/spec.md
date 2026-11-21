# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-631 — Each use case has a specification whose flows name the scenarios that prove them

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-631.feature actor=Developer kind=functional -->

The system SHALL read a use case's specification — `# UC-NNN — <name>`, `## Overview`, `## Actors`, `## Preconditions`, `## Main flow (SCN-…)` with numbered steps, `## Alternative flows` of `### A<n> — <what> (at step <n>) (SCN-…)` with numbered steps, `## Postconditions` and `## Business rules` naming requirements — and SHALL refuse, at archive, a change's `use-cases/UC-NNN.md` whose title is another id, that has no overview or no main flow with steps, a flow naming no scenario or one no requirement of the use case has, an alternative starting at a step the main flow lacks or with no steps, or a scenario of the use case's requirements no flow names; otherwise archive SHALL write it to `docs/specs/use-cases/UC-NNN.md`, and delete that file for a use case the change removes.

> #544, from AI Unified Process Studio: a use-case specification per use case — overview, preconditions, main success scenario, alternative flows, postconditions, business rules — here with every flow proved by a scenario.

#### Scenario: SCN-631a — A specification read

- GIVEN UC-004's specification with an overview, Tutor, a precondition, a main flow of three steps naming SCN-012, A1 at step 3 naming SCN-013, a postcondition and a rule naming REQ-014
- WHEN specgate reads it
- THEN it has each section, the two flows with their steps and scenarios, and nothing to fix when its requirements' scenarios are SCN-012 and SCN-013

#### Scenario: SCN-631b — A scenario no flow names

- GIVEN UC-004's A1 naming SCN-099, and its requirements' scenarios SCN-012 and SCN-013
- WHEN specgate checks it
- THEN it names SCN-099 as no scenario of UC-004 and SCN-013 as named by no flow

#### Scenario: SCN-631c — The specification archived

- GIVEN a change adding UC-007 with REQ-001, and its use-cases/UC-007.md whose main flow names SCN-001a
- WHEN the Developer archives it
- THEN docs/specs/use-cases/UC-007.md holds the specification

### Requirement: REQ-632 — A draft writes each use case's specification

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-632.feature actor=Developer kind=functional -->

The system SHALL tell the agent, in `DRAFTING.md`, to write `use-cases/UC-NNN.md` for each use case it adds or modifies, with its sections and every flow naming its scenario; and SHALL keep a draft with `use-cases.md` from ready while such a use case has no specification (`D15_no_spec`) or its specification has the faults REQ-631 names (`D15_ucs_…`) — for a modified use case some requirement outside the draft delivers, only what the draft holds is checked.

#### Scenario: SCN-632a — The guide asks for it

- GIVEN a brief with the module bookings
- WHEN the Developer runs `specgate draft bookings`
- THEN DRAFTING.md has a section on use-cases/UC-NNN.md with a main flow naming a scenario and an alternative at a step

#### Scenario: SCN-632b — A draft held back by its specification

- GIVEN the bookings draft with UC-900 delivered by REQ-002 and its scenarios SCN-002 and SCN-003
- WHEN UC-900 has no specification, then one whose flows name only SCN-002
- THEN the draft is not ready with `D15_no_spec`, then with `D15_ucs_scenario_unflowed` naming SCN-003; with both named it is ready to review

### Requirement: REQ-633 — The gate names a use case with no specification

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-633.feature actor=Developer kind=functional -->

The system SHALL report, under the gate rule `use_cases` (REQ-627), every use case of `docs/specs/use-cases.md` with no `docs/specs/use-cases/UC-NNN.md` (`use_case_no_spec`).

#### Scenario: SCN-633a — A use case with no specification

- GIVEN the catalog's UC-002 and UC-003, and a specification for UC-002 only
- WHEN the rule runs
- THEN it names UC-003 `use_case_no_spec`, and nothing once UC-003 has one

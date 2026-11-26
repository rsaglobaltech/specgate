# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-637 — Each entity's state machine is read and checked against the requirements

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL read an entity's state machine from `docs/specs/state-machines/<Entity>.md` — `# <Entity> — states`; `## States` as `- <name> (initial|final) — <behaviour>`; `## Transitions` as a `From | To | Trigger | Requirement` table whose trigger is `event [guard] / action`; `## Forbidden` as `- <from> → <to> (REQ-NNN)` — and `validate --strict`, under the gate rule `state_machines` (error in the strict and standard presets, warning in minimal), SHALL fail a machine that lists no states, none or two initial states, a state twice, a transition or forbidden transition naming a state it lacks, a transition naming a requirement the matrix lacks, or a transition the machine forbids; and SHALL report, without failing, a state no transition from the initial one reaches, a state with no way out that is not final, and a transition that names no requirement.

> The Reviewer asked to see, as in Visual Paradigm, how a request moves from received to available, and that only what a requirement asks for be drawn.

#### Scenario: SCN-637a — A machine read

- GIVEN GenerationRequest with Received initial, Validating, Authorized, Available and Rejected final, four transitions naming REQ-011, REQ-046 and REQ-018, and Rejected → Available forbidden by REQ-034
- WHEN specgate reads it
- THEN it has the five states with their behaviour, the transitions with their requirements, the forbidden one, and nothing to fix

#### Scenario: SCN-637b — What a machine cannot hold

- GIVEN a transition into Availible naming REQ-099, and Rejected → Available as a transition
- WHEN specgate checks the machine
- THEN it names sm_unknown_state, sm_unknown_requirement and sm_forbidden_used as errors

#### Scenario: SCN-637c — What a machine is warned about

- GIVEN Expired final that no transition reaches, Rejected not final with no way out, and Authorized → Available naming no requirement
- WHEN specgate checks the machine
- THEN it warns sm_unreachable for Expired, sm_dead_end for Rejected and sm_transition_untraced

#### Scenario: SCN-637d — A machine that holds, at the gate

- GIVEN Order with Paid → Cancelled naming REQ-002 and Paid → Shipped naming none
- WHEN the Developer runs `specgate validate . --strict --json`
- THEN the gate passes and reports sm_transition_untraced

#### Scenario: SCN-637e — A machine that does not hold, at the gate

- GIVEN Order with Paid → Shipped naming REQ-404 and Shipped → Cancelled, which it forbids
- WHEN the Developer runs `specgate validate . --strict`
- THEN the gate fails naming sm_forbidden_used, sm_unknown_requirement and docs/specs/state-machines/Order.md; under the minimal preset it reports them and passes

### Requirement: REQ-638 — A change's delta to a state machine is applied at archive

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL take a change's `state-machines/<Entity>.md` — `# Delta — <Entity>` with `## ADDED States`, `## MODIFIED States`, `## REMOVED States`, `## ADDED Transitions`, `## MODIFIED Transitions`, `## REMOVED Transitions`, `## ADDED Forbidden` and `## REMOVED Forbidden`, a transition known by its states and the words of its trigger before any guard or action — and, at archive, SHALL write the machine it leaves to `docs/specs/state-machines/<Entity>.md`, create it for an entity that had none, and delete it when no state is left; and SHALL refuse the change, writing nothing, when the delta adds a state or transition that exists, modifies or removes one that does not, removes a state a transition still uses, names a requirement neither the matrix nor the change has, or leaves a machine REQ-637 fails; a requirement no transition names any more SHALL be warned.

#### Scenario: SCN-638a — Added, modified, lifted

- GIVEN GenerationRequest and a delta adding Paused with Authorized → Paused and back, modifying Available and Authorized → Available, and removing the forbidden Rejected → Available
- WHEN the delta is applied
- THEN the machine has Paused and its two transitions, Available's new behaviour, Authorized → Available naming REQ-011 and REQ-018, no forbidden transition, and nothing to fix

#### Scenario: SCN-638b — What a delta cannot remove

- GIVEN a delta removing Rejected, which Validating → Rejected uses, and Expired and Received → Authorized, which do not exist
- WHEN specgate checks the delta
- THEN it names sm_state_in_use with Validating → Rejected, sm_state_unknown and sm_transition_unknown

#### Scenario: SCN-638c — A requirement left out

- GIVEN a delta removing Validating → Rejected, the only transition naming REQ-046
- WHEN specgate checks the delta
- THEN it warns sm_requirement_uncovered for REQ-046

#### Scenario: SCN-638d — Paused added to the machine at archive

- GIVEN a change adding REQ-050 and Paused with Validating → Paused and back naming REQ-050
- WHEN the Developer archives it
- THEN docs/specs/state-machines/GenerationRequest.md has Paused and its transitions, and keeps the others

#### Scenario: SCN-638e — Refused at archive

- GIVEN a change removing Rejected, which a transition uses, and adding a transition naming REQ-099
- WHEN the Developer archives it
- THEN archive refuses it with sm_state_in_use and sm_unknown_requirement, and the machine is unchanged

### Requirement: REQ-639 — State machines reach PlantUML, the studio and the agent that drafts

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL write, at `check`, each machine's PlantUML beside it — `docs/specs/state-machines/<Entity>.puml`, its initial and final states, each transition labelled with its trigger and requirements, the forbidden ones in a «constraint» note — and report a copy edited by hand as `state_machine_diagram_stale`; SHALL carry the machines in `status --json` as `stateMachines` (null when there are none); SHALL tell the agent, in `DRAFTING.md`, to write an entity's machine as a delta when the brief describes its states; and SHALL keep a draft from ready while a machine it writes does not apply or does not hold (`D16_…`), its requirements being the draft's and the project's.

#### Scenario: SCN-639a — PlantUML of a machine

- GIVEN GenerationRequest
- WHEN specgate renders it
- THEN the PlantUML starts in Received, labels Validating → Authorized with `validate [safe]` and REQ-011, ends from Available, and notes Rejected → Available as forbidden

#### Scenario: SCN-639b — Written and carried

- GIVEN Order's machine
- WHEN the Developer runs `specgate check`, then `specgate status --json`
- THEN docs/specs/state-machines/Order.puml holds its transitions and status lists Order with its file, its PlantUML and its transitions

#### Scenario: SCN-639c — The guide asks for it

- GIVEN a brief with the module bookings
- WHEN the Developer runs `specgate draft bookings`
- THEN DRAFTING.md has "1d. An entity's states" with ADDED States, ADDED Transitions with their Requirement column, and ADDED Forbidden

#### Scenario: SCN-639d — A draft's machine checked

- GIVEN the draft of bookings writing Booking's machine with a transition into Confirmd naming REQ-404
- WHEN the Developer runs `specgate draft bookings`
- THEN it is not ready, naming D16_sm_unknown_requirement, then D16_sm_unknown_state; once corrected it is ready to review

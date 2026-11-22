# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-653 — The agent's front matter is fixed before it is shown

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

The system SHALL tell the agent that proposes a brief's front matter that a system the brief names — a service the product calls or one that calls it, a provider, a device — uses `api`, which then goes in `surfaces` too, and that an actor's surfaces are never empty; and SHALL, when the front matter the agent wrote has problems and the brief below it is unchanged, run the agent once more with each problem and its fix before it answers, answering what that second pass left.

#### Scenario: SCN-653a — A service left with no surfaces

- GIVEN an agent whose first front matter gives "Servicio de transcripción" no surfaces, and which fixes a problem it is told
- WHEN the Developer runs `specgate draft --agent <it> --json`
- THEN the agent ran twice, the second time told brief_actor_without_surfaces, and the brief says `{ name: Servicio de transcripción, surfaces: [api] }` with no problem left and its body unchanged

#### Scenario: SCN-653b — The guide says it

- GIVEN any brief
- WHEN the agent's guide is written
- THEN it says a system the brief names uses `api` and an actor's surfaces are never empty

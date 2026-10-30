# Delta — workspace

## ADDED Requirements

### Requirement: REQ-376 — A quoted story title is read whole

The system SHALL read a story of the workspace brief's front matter whose title is quoted and holds a comma as that whole title, without its quotes, wherever the stories are listed.

#### Scenario: SCN-376a — A quoted story title in the stories table

- GIVEN `stories:` holds `{ id: plan-route, title: "Optimización de rutas, con restricciones de vehículo pesado", repos: [fleet] }`
- WHEN a person runs `specgate workspace draft`
- THEN the table shows plan-route with "Optimización de rutas", and no quote

<!-- specgate:trace status=Implemented test=tests/unit/rc4-ticks.test.ts actor=Developer kind=functional -->

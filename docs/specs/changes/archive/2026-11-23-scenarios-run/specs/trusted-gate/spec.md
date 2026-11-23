# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-666 — A requirement's scenarios run one by one

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-666.feature actor=Developer kind=functional -->

The system SHALL, on `specgate scenarios <REQ> [--json]`, run each scenario of the requirement's feature files — every scenario tagged with one of its `@SCN-` ids — through the project's `bdd_cmd`, `{tags}` its own tag, one after the other, and answer for each its id, its name, its file and 1-based line, whether it passed, its exit and the last lines of its output; with no `bdd_cmd` it SHALL refuse with `bdd_cmd_missing`, and with no scenario `scenarios_none`; a scenario that fails SHALL be a `scenario_failed` finding, the command exiting 1.

> Studio (agent-panel 4c, 2026-11-22): each scenario green or red in the feature file's margin, and the requirement's way — scenarios, red, code, green, gate, apply — from what really ran.

#### Scenario: SCN-666a — One scenario passes, one fails

- GIVEN REQ-031's feature with SCN-031a and SCN-031b, and a `bdd_cmd` that passes only `@SCN-031a`
- WHEN the Developer runs `specgate scenarios REQ-031 --json`
- THEN SCN-031a passed and SCN-031b did not, each with its line, and the answer exits 1 with `scenario_failed` naming SCN-031b

#### Scenario: SCN-666b — No runner

- GIVEN a project with no `bdd_cmd`
- WHEN the Developer runs `specgate scenarios REQ-031 --json`
- THEN it is refused with `bdd_cmd_missing`, its fix `specgate config set bdd_cmd`

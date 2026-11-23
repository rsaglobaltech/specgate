# Brief Drafting

## Requirements

### Requirement: REQ-667 — A brief's language becomes the project's

The system SHALL, when a module is drafted from a brief and the project sets no `language`, read the brief's language — Spanish or English, by its common words —, keep it as the project's `language` in `.specgate/config.json`, and say so; the drafting guide SHALL then ask for the titles, the statements and the scenarios' steps in that language.

> pintamundo's REQ-002.feature (2026-11-22): a Spanish brief, Spanish titles, English steps — "Undefined step: the family is authorised…" under "Característica"-less "Feature: Entrada con credenciales válidas".

#### Scenario: SCN-667a — A Spanish brief, no language set

- GIVEN a project with no `language` and a brief written in Spanish
- WHEN the Developer runs `specgate propose --from-brief pedidos`
- THEN `.specgate/config.json` holds `language: es`, and DRAFTING.md asks for the scenarios' steps in Spanish

<!-- specgate:trace actor=Developer feature=features/brief-drafting/REQ-667.feature kind=functional status=Implemented -->

### Requirement: REQ-668 — A scenario's steps in another language

The system SHALL report, on `specgate draft --check`, `D16_scenario_language` for a scenario whose steps are in another language than the project's — or than its own title when the project sets none —, at the scenario's line, its fix to write its steps in that language.

#### Scenario: SCN-668a — Spanish title, English steps

- GIVEN a draft whose SCN-002 is titled "El adulto entra con credenciales válidas" and whose steps read "the family is authorised and its child profile exists"
- WHEN the Developer runs `specgate draft --check`
- THEN `D16_scenario_language` names SCN-002, its fix to write its steps in Spanish

<!-- specgate:trace actor=Developer feature=features/brief-drafting/REQ-668.feature kind=functional status=Implemented -->

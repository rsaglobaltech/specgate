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

<!-- specgate:trace actor=Developer artifact="packages/core/src/domain/DraftChecklist.ts, scripts/cli/commands/spec/DraftCommand.ts" feature=features/brief-drafting/REQ-668.feature kind=functional status=Implemented -->

### Requirement: REQ-799 — A requirement's brief quote is in the brief

The system SHALL report, on `specgate draft --check` and while a module is drafted, `D17_quote_not_in_brief` for each `> Brief: "…"` line of a requirement whose text is not in the brief — compared without case, quote marks, emphasis, runs of space or the closing punctuation — at the quote's line, its fix to quote the brief's own sentence or drop the requirement; and SHALL skip the rule when no brief is given.

> Reported on 2026-11-27: REQ-011 quoted «Recuperación de acceso.» and stated the opposite of the brief; the checklist passed, and no code read the quote back.

#### Scenario: SCN-799a — A quote the brief never wrote

- GIVEN a brief that says "A member recovers access with their email." and REQ-011 quoting `> Brief: "Access is never recovered."`
- WHEN the draft is checked
- THEN `D17_quote_not_in_brief` names REQ-011 at the quote's line

#### Scenario: SCN-799b — The brief's sentence, wrapped and quoted

- GIVEN the same brief, its sentence wrapped over two lines, and REQ-011 quoting `> Brief: "A member *recovers* access with their email"`
- WHEN the draft is checked
- THEN no `D17_quote_not_in_brief` is reported

<!-- specgate:trace actor=Developer feature=features/brief-drafting/REQ-799.feature kind=functional status=Implemented -->

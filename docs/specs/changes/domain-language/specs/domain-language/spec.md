# Delta — domain-language

## ADDED Requirements

### Requirement: REQ-538 — The glossary keeps one word for one thing

The system SHALL read `docs/specs/glossary.md`, when it exists, as a table of `Term`, `Definition` and `Avoid` columns; `specgate validate` SHALL report `glossary_term_forbidden` — naming the file, the line, the word found and the term to use — for each word listed under `Avoid` that appears in a requirement or a scenario; and `specgate init` and `adopt` SHALL write an empty glossary with the three columns.

#### Scenario: SCN-538a — A requirement says "client"

- GIVEN a glossary with the term `Customer` whose `Avoid` column lists `client`, and REQ-001 whose text says "a client downloads the invoice"
- WHEN a tool runs `specgate validate --json`
- THEN it reports `glossary_term_forbidden` for `client` on REQ-001's line, with `Customer` as the term to use

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-539 — Business rules are numbered and each one is tested

The system SHALL read a `Rules:` list in a requirement's body whose items start with `BR-NNN`, rule ids unique across the specification; the traceability matrix SHALL add a `Rules` column with the requirement's rule ids; and `specgate validate --strict` SHALL report `rule_untested` for each rule of a delivered requirement that no test mentions, and `rule_duplicate` for a rule id used twice.

#### Scenario: SCN-539a — One rule tested, one not

- GIVEN REQ-001 `Implemented` with the rules BR-001 and BR-002, and a test that mentions REQ-001 and BR-001
- WHEN a tool runs `specgate validate --strict --json`
- THEN it fails with `rule_untested` for BR-002, and the matrix row for REQ-001 lists BR-001 and BR-002

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-540 — The entity model is generated

The system SHALL generate `docs/specs/model.md` — a Mermaid `erDiagram` with one entity per aggregate and its attributes and relations, followed by one table per entity — from the aggregates of the installed domain packs and from `docs/specs/model.yaml` when it exists; `check` SHALL regenerate it; and `specgate validate` SHALL report `model_stale` when the committed file differs from what its sources generate.

#### Scenario: SCN-540a — A pack's aggregate becomes an entity

- GIVEN a project with the `billing` pack installed, whose aggregates are `Invoice` and `Payment`
- WHEN a tool runs `specgate check`, then edits `docs/specs/model.md` by hand and runs `specgate validate --json`
- THEN the generated file has an `erDiagram` with `Invoice` and `Payment`, and `validate` reports `model_stale`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-541 — The actors diagram is generated

The system SHALL generate `docs/specs/actors.md` — a Mermaid `flowchart` linking each actor to the capabilities and requirements that name it — from the actors in `docs/brief.md`'s front matter and the `actor=` of each requirement's trace; `check` SHALL regenerate it; and `specgate validate` SHALL report `actors_stale` when the committed file differs, and `actor_unknown` for a requirement whose actor the brief does not list.

#### Scenario: SCN-541a — Two actors, one unknown

- GIVEN a brief with the actors `Customer` and `Clerk`, REQ-001 with `actor=Customer` and REQ-002 with `actor=Admin`
- WHEN a tool runs `specgate check` then `specgate validate --json`
- THEN `docs/specs/actors.md` links `Customer` to REQ-001, and `validate` reports `actor_unknown` for REQ-002 naming `Admin`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

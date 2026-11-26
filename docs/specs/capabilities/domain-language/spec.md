# Domain Language

## Requirements

### Requirement: REQ-538 — The glossary keeps one word for one thing

The system SHALL read `docs/specs/glossary.md`, when it exists, as a table of `Term`, `Definition` and `Avoid` columns; `specgate validate` SHALL report `glossary_term_forbidden` — naming the file, the line, the word found and the term to use — for each word listed under `Avoid` that appears, as a whole word outside code and comments, in a requirement or a scenario, as a warning, and as an error under `--strict`; and `specgate init` and `adopt` SHALL write an empty glossary with the three columns.

#### Scenario: SCN-538a — A requirement says "client"

- GIVEN a glossary with the term `Customer` whose `Avoid` column lists `client`, and REQ-001 whose text says "a client downloads the invoice"
- WHEN a tool runs `specgate validate --json`
- THEN it reports `glossary_term_forbidden` for `client` on REQ-001's line, with `Customer` as the term to use

<!-- specgate:trace actor=Developer feature=features/domain-language/REQ-538.feature kind=functional status=Implemented -->

### Requirement: REQ-539 — Business rules are numbered and each one is tested

The system SHALL read a `Rules:` list in a requirement's body whose items start with `BR-NNN`, rule ids unique across the specification; `specgate validate` SHALL report `rule_duplicate` for a rule id used twice — by two requirements, or twice in one file — and SHALL NOT report it for an open change's delta that restates the same requirement with its rules; and `specgate validate --strict` SHALL report `rule_untested` for each rule of a delivered requirement that no test mentions. The traceability matrix keeps its columns: a rule is linked to its test by the test naming it.

#### Scenario: SCN-539a — One rule tested, one not

- GIVEN REQ-001 `Implemented` with the rules BR-001 and BR-002, and a test that mentions REQ-001 and BR-001
- WHEN a tool runs `specgate validate --strict --json`
- THEN it fails with `rule_untested` for BR-002 only

#### Scenario: SCN-539b — A change restates a requirement with rules

- GIVEN REQ-014 in a capability spec with the rules BR-021 and BR-022, and an open change whose MODIFIED delta restates REQ-014 with both rules
- WHEN a tool runs `specgate validate --json`
- THEN it reports no `rule_duplicate`; with a second requirement that also uses BR-021, it reports `rule_duplicate` for BR-021

<!-- specgate:trace actor=Developer feature=features/domain-language/REQ-539.feature kind=functional status=Implemented -->

### Requirement: REQ-540 — The entity model is generated

The system SHALL generate `docs/specs/model.md` — a Mermaid `erDiagram` with one entity per aggregate and its attributes and relations, followed by one table per entity — from the aggregates the installed domain packs write to `docs/specs/aggregates.md` and from `docs/specs/model.yaml` when it exists; `check` SHALL regenerate it when there is an entity to draw; and `specgate validate` SHALL report `model_stale` when a committed file differs from what its sources generate.

#### Scenario: SCN-540a — A pack's aggregate becomes an entity

- GIVEN a project whose `docs/specs/aggregates.md` lists `Invoice` and `Payment`, as the `billing` pack writes it
- WHEN a tool runs `specgate check`, then edits `docs/specs/model.md` by hand and runs `specgate validate --json`
- THEN the generated file has an `erDiagram` with `Invoice` and `Payment`, and `validate` reports `model_stale`

<!-- specgate:trace actor=Developer feature=features/domain-language/REQ-540.feature kind=functional status=Implemented -->

### Requirement: REQ-541 — The actors diagram is generated

The system SHALL generate `docs/specs/actors.md` — a Mermaid `flowchart` linking each actor to the capabilities and requirements that name it — from the actors in `docs/brief.md`'s front matter and the `actor=` of each requirement's trace; `check` SHALL regenerate it when the brief names an actor; an actor SHALL match the brief's ignoring case, and be drawn as the brief spells it; and `specgate validate` SHALL report `actors_stale` when the committed file differs, and warn `actor_unknown` for a requirement whose actor the brief does not list.

#### Scenario: SCN-541a — Two actors, one unknown

- GIVEN a brief with the actors `Customer` and `Clerk`, REQ-001 with `actor=Customer` and REQ-002 with `actor=Admin`
- WHEN a tool runs `specgate check` then `specgate validate --json`
- THEN `docs/specs/actors.md` links `Customer` to REQ-001, and `validate` reports `actor_unknown` for REQ-002 naming `Admin`

#### Scenario: SCN-541b — An actor written in another case

- GIVEN a brief with the actor `Customer`, and REQ-001 with `actor=customer`
- WHEN a tool runs `specgate check` then `specgate validate --json`
- THEN `docs/specs/actors.md` links `Customer` to REQ-001, and `validate` reports no `actor_unknown`

<!-- specgate:trace actor=Developer feature=features/domain-language/REQ-541.feature kind=functional status=Implemented -->

### Requirement: REQ-594 — The actors drawn without a brief, and kept current

The system SHALL draw `docs/specs/actors.md` from the actors `docs/brief.md` names or, when there is no brief or it names none and the project keeps that file, from the actors the delivered requirements' `actor=` name, never adding the file to a project that has none, treating spellings that differ only in case as one; SHALL draw it again on `check` and on `archive`; and SHALL, on `check`, say why it is not drawn when no actor is named anywhere.

#### Scenario: SCN-594a — A project with requirements and no brief

- GIVEN a project with no brief and requirements whose actor is Customer, Clerk and customer
- WHEN the person runs `specgate check`
- THEN `docs/specs/actors.md` draws Customer and Clerk, with the third requirement under Customer, and check says it regenerated it

#### Scenario: SCN-594b — Nothing names an actor

- GIVEN a project with no brief and no requirement with an actor
- WHEN the person runs `specgate check`
- THEN check says `docs/specs/actors.md` is not drawn, and why

<!-- specgate:trace actor=Developer feature=features/domain-language/REQ-594.feature kind=functional status=Implemented -->

### Requirement: REQ-595 — The glossary's missing terms, suggested

The system SHALL name, on `specgate check`, the actors and the domain model's entities that `docs/specs/glossary.md` does not define yet, each once and ignoring case, writing nothing; and SHALL, on archiving a change, add each as a row of the glossary's table with its Definition and Avoid left empty — only where the project keeps a glossary.

#### Scenario: SCN-595a — A customer the glossary does not define

- GIVEN a project whose requirement names the actor Customer and whose glossary is empty
- WHEN the person runs `specgate check`, then archives a change
- THEN check names Customer and writes nothing; the archive adds the row `| Customer |  |  |`, and Customer is no longer missing

<!-- specgate:trace actor=Developer feature=features/domain-language/REQ-595.feature kind=functional status=Implemented -->

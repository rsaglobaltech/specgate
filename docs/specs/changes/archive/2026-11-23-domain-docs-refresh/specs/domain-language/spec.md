# Delta — domain-language

## ADDED Requirements

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

<!-- specgate:trace status=Implemented feature=features/domain-language/REQ-594.feature actor=Developer kind=functional -->

### Requirement: REQ-595 — The glossary's missing terms, suggested

The system SHALL name, on `specgate check`, the actors and the domain model's entities that `docs/specs/glossary.md` does not define yet, each once and ignoring case, writing nothing; and SHALL, on archiving a change, add each as a row of the glossary's table with its Definition and Avoid left empty — only where the project keeps a glossary.

#### Scenario: SCN-595a — A customer the glossary does not define

- GIVEN a project whose requirement names the actor Customer and whose glossary is empty
- WHEN the person runs `specgate check`, then archives a change
- THEN check names Customer and writes nothing; the archive adds the row `| Customer |  |  |`, and Customer is no longer missing

<!-- specgate:trace status=Implemented feature=features/domain-language/REQ-595.feature actor=Developer kind=functional -->

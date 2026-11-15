# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-486 — The brief read as a form, each field with its line

The system SHALL answer `specgate propose --from-brief --form --json`, and the API's `briefForm(dir)`, with the brief as a form — its front matter's product, surfaces, actors and modules, and each module with its key, name, prose, rules, examples and questions — giving the line of each field in the file, or null for one the file does not hold, and the brief's findings under `status`; and SHALL write nothing.

#### Scenario: SCN-486a — A module with its section and one without

- GIVEN docs/brief.md with `modules: [orders, payments]` on line 6, a section `## Module: orders` whose first rule is on line 14, no section for payments, and a paragraph "Notes from the call" outside every module
- WHEN `specgate propose --from-brief --form --json` runs
- THEN the form gives `modules` at line 6, orders' first rule with line 14, payments with a null line and no cards, and docs/brief.md is unchanged

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-487 — The form written back, every other byte kept

The system SHALL, with `specgate propose --from-brief --form <file>` (`-` reads standard input) and the API's `writeBriefForm(dir, form)`, write a form of REQ-486's shape back into the brief, rewriting only the front matter fields and the module sections whose values changed and keeping every other byte as it was — the line endings, CRLF included, the text after the last section, and every section that is not a module's; and the studio's own save of the brief SHALL use the same code.

#### Scenario: SCN-487a — A CRLF brief with notes after its last module

- GIVEN a docs/brief.md written with CRLF, with a `## Context` section, the modules orders and payments, and two blank lines and a note after payments' section
- WHEN its form is read, a rule is added to orders, and the form is written back
- THEN the brief has the new rule under orders, every line still ends in CRLF, and every byte outside orders' section is as it was; written back with no change, the file is identical byte for byte

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-488 — A client's text outside the project proposed as a form

The system SHALL, when `specgate propose --from-brief --brief <file> --agent <cmd> --json` runs on a file outside the project, let the agent write only that file, answer what it proposed under `form` in REQ-486's shape, and write, create or remove nothing inside the project — no `docs/specs/BRIEF-SETUP.md` or `docs/specs/BRIEF-CARDS.md` — even when the proposed front matter has problems.

#### Scenario: SCN-488a — The proposed front matter has a problem

- GIVEN a project in git and the client's text in a file outside it
- WHEN `specgate propose --from-brief --brief <that file> --agent <cmd> --json` runs and the agent proposes a front matter whose actor uses a surface `surfaces` does not list
- THEN the answer gives the form with the proposed product and modules and the problem under `status`, and the project's files and `git status` are as before

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

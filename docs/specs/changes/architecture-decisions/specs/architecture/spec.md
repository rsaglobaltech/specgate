# Delta — architecture

## ADDED Requirements

### Requirement: REQ-546 — Decisions are recorded and superseded, never rewritten

The system SHALL, with `specgate adr new "<title>"`, write `docs/specs/adr/NNNN-<slug>.md` with the next number, the status `Proposed`, the date and the sections Context, Decision and Consequences; with `specgate adr supersede <NNNN> "<title>"`, write a new ADR that names the old one and set the old one's status to `Superseded by NNNN`, changing nothing else in it; and with `specgate adr list --json`, list every ADR with its number, title and status.

#### Scenario: SCN-546a — A decision replaced

- GIVEN a project with `docs/specs/adr/0001-use-postgres.md`, status `Accepted`
- WHEN a tool runs `specgate adr supersede 0001 "Use SQLite for the edge"` then `specgate adr list --json`
- THEN `0002-use-sqlite-for-the-edge.md` exists and names 0001; 0001's status is `Superseded by 0002` and its other lines are unchanged; and the list has both

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-547 — The agent decides only what its rights allow

The system SHALL read `docs/specs/decision-rights.md`, when it exists, as a table of the decisions `dependency`, `migration` and `public-api`, each `agent` or `ask`; the harness SHALL include the table in the agent's prompt; and an attempt whose diff adds a dependency to a manifest, a file to a migration folder, or an operation to an OpenAPI file when that decision is `ask` SHALL fail with `decision_right_exceeded` naming the decision and the file.

#### Scenario: SCN-547a — The agent adds a library

- GIVEN a decision-rights file with `dependency` set to `ask`, and an agent that implements REQ-001 and adds `left-pad` to `package.json`
- WHEN a tool runs `specgate harness run --req REQ-001 --json`
- THEN the attempt fails with `decision_right_exceeded` naming `dependency` and `package.json`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-548 — The stack file names the layers and their commands

The system SHALL, with `specgate stack [--json]`, write `docs/specs/stack.md` with a table of the layers it detects — migration, persistence, service, API, UI, end-to-end — each with its technology and the evidence it was detected from, and a table of commands (build, test, affected test, end-to-end); the harness and `check` SHALL take a command from it when the configuration sets none; and a second run on an unchanged project SHALL change nothing.

#### Scenario: SCN-548a — A Spring and Flyway project

- GIVEN a Maven project with Spring Boot, Flyway migrations under `src/main/resources/db/migration` and no `test_cmd` configured
- WHEN a tool runs `specgate stack` twice, then `specgate check --json`
- THEN `stack.md` lists `migration` as Flyway and `service` as Spring Boot with their evidence, the second run changes nothing, and `check` runs the stack file's test command

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

# Delta — harness

## ADDED Requirements

### Requirement: REQ-649 — A requirement no test proved ends unverified, never passed

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL warn, before any agent runs, when the project has no test command — the gate cannot run the tests and each requirement ends unverified — and SHALL end a requirement whose gate passed with no test command as `unverified`, not `pass`: after one attempt, its work committed on its branch as "attempt is UNVERIFIED — do not merge as is", not delivered, counted apart in the report, the run not passing, its dependants not built and `--chain` stopping, with the error saying to set the test command.

> Found on pintamundo-ai: REQ-001 ended `pass` with its test never run — the project had no test command, and the agent could run none.

#### Scenario: SCN-649a — No test command

- GIVEN a scaffolded project with no test command and an agent that writes REQ-000's code
- WHEN the Developer runs `specgate harness run --req REQ-000 --max-attempts 3 --format json`
- THEN the run warns "No test command", REQ-000 ends unverified after one attempt, its branch's last commit says it is UNVERIFIED, the matrix does not say it is implemented, and the run does not pass

### Requirement: REQ-650 — The agent runs without the person's MCP servers, and may run the gate's checks

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL run Claude Code in print mode — drafting, building, answering in `agent ask` — with `--strict-mcp-config`, loading none of the person's MCP servers, unless the command names its own MCP configuration; and SHALL allow the building agent the architecture check the gate runs, besides its test command, and no other command.

> On pintamundo-ai each call loaded 345 tools of the person's account; a question in the studio took minutes.

#### Scenario: SCN-650a — No MCP server

- GIVEN the harness's agent, a drafting agent and one with its own permission
- WHEN Specgate runs them
- THEN each carries `--strict-mcp-config` once, and one naming `--mcp-config` is kept as it is

#### Scenario: SCN-650b — The gate's checks allowed

- GIVEN the test command `npm test` and the architecture check `npm run arch`
- WHEN the harness gives the agent its permissions
- THEN it may run both, and no other command

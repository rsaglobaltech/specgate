# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-162 — OpenCode gets the loop's commands

The system SHALL, on `specgate agents init --tool opencode`, and by default when the project has a `.opencode` folder or an `opencode.json`, write one command per step of the daily loop as `.opencode/commands/specgate-<step>.md` — a description in its front matter and the step's commands with `$ARGUMENTS` where the step takes an argument — and the agent contract in `AGENTS.md`, which OpenCode reads; and SHALL list `opencode` among the tools in `specgate agents init --help`.

#### Scenario: SCN-162a — A project that uses OpenCode

- GIVEN a project with an `opencode.json` and no agent files
- WHEN the developer runs `specgate agents init --tool opencode`
- THEN `.opencode/commands/specgate-draft.md` exists, starts with front matter naming a description, runs `specgate propose --from-brief $ARGUMENTS`, and `AGENTS.md` exists

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

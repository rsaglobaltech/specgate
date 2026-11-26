# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-596 — The project's agent, not Claude for every project

The system SHALL know Codex as an agent Build runs, with the command `codex exec -s workspace-write - < {prompt_file}`; SHALL, when it sets `agent:` itself (adoption, `agents init` without `--tool`), choose the agent whose folder or instructions the project carries (`.codex/` for Codex; `.claude/` or `CLAUDE.md` for Claude Code) when that agent is installed, else the first installed; and SHALL set Codex on `agents init --tool codex`, never over an `agent:` a person set.

#### Scenario: SCN-596a — A Codex project, with Claude installed too

- GIVEN a project with `.codex/`, and both Codex and Claude Code installed
- WHEN the agent is chosen
- THEN Codex is chosen

#### Scenario: SCN-596b — Codex named

- GIVEN a project with no `agent:`
- WHEN the person runs `specgate agents init --tool codex`
- THEN `harness.config.yaml` says `agent: codex exec -s workspace-write - < {prompt_file}`

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-596.feature actor=Developer kind=functional -->

### Requirement: REQ-597 — Codex gets specgate's steps

The system SHALL, on `agents init --tool codex` or in a project carrying `.codex/`, write specgate's steps as skills in `.agents/skills/`, where Codex reads them, keeping a skill changed by hand unless `--force`; and SHALL not write them for a tool that does not read them.

#### Scenario: SCN-597a — The steps in Codex

- GIVEN a project set up for Codex
- WHEN the person runs `specgate agents init --tool codex`
- THEN `.agents/skills/` holds specgate-draft, specgate-apply and specgate-check, each with its SKILL.md

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-597.feature actor=Developer kind=functional -->

### Requirement: REQ-598 — What to tell your agent, from the project

The system SHALL print, on `specgate status --prompt` (`start`), `--prompt draft` and `--prompt build`, in English, what a person gives an agent to work on the project — read AGENTS.md, the next step `specgate status` names, the brief's modules left to draft, how the installed agents call specgate's steps, and the rules the agent never breaks — and SHALL give it as data with `--json`.

#### Scenario: SCN-598a — The prompt for a Codex project

- GIVEN a project set up for Codex whose next step is `specgate apply REQ-000`
- WHEN the person runs `specgate status --prompt`
- THEN it prints that this project uses specgate, to read AGENTS.md, the next step, Codex's `$specgate-draft`, and the rules

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-598.feature actor=Developer kind=functional -->

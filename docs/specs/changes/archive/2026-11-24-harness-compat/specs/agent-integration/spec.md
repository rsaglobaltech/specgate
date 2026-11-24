# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-711 — The compatibility exam for a tool, a level and n runs

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-711.feature actor=Developer kind=functional -->

The system SHALL, on `specgate compat run --tool <claude|codex|opencode>[,…] --level <L0|L1|L2|L3>[,…] --runs <n>`, copy the shipped compatibility project once per run, give the tool that level's integration, run the tool with the task's prompt, then run `specgate check` and the hidden check in the copy, and append to `.specgate/compat/runs.jsonl` one line per run with the tool, its version, the model, the level, both verdicts, whether a test names REQ-002, the seconds taken and the agent's exit code.

> Found on 2026-11-24: Specgate generates files for 12 tools and had been seen working from two.

#### Scenario: SCN-711a — A tool that implements the requirement

- GIVEN a fake codex that writes REQ-002's test and code
- WHEN the Developer runs `specgate compat run --tool codex --level L0 --runs 1`
- THEN runs.jsonl has one line for codex at L0 with check passed, hidden check passed and a test naming REQ-002

#### Scenario: SCN-711b — A tool that only claims it did

- GIVEN a fake codex that prints "Done, all tests pass" and writes nothing
- WHEN the Developer runs `specgate compat run --tool codex --level L0 --runs 1`
- THEN the line has check failed and hidden check failed, whatever the agent printed

### Requirement: REQ-712 — Each level gives the tool exactly its integration

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-712.feature actor=Developer kind=functional -->

The system SHALL give the copy, per level: at L0 only the tool's rules file from `agents init`; at L1 those rules and the tool's skills or commands; at L2 those and Specgate's MCP server; at L3 those and the tool's plugin, which exists for Claude Code and OpenCode; a level the tool has no form for SHALL be recorded as `n/a` and not run.

> The question each level answers differs: whether the written rules suffice, whether the loop is followed, whether the tools are used instead of guessed.

#### Scenario: SCN-712a — Rules only at L0

- GIVEN a run of opencode at L0
- WHEN the copy is made
- THEN it has AGENTS.md, and no .agents/skills, no MCP configuration and no plugin

#### Scenario: SCN-712b — No plugin for Codex

- GIVEN `specgate compat run --tool codex --level L3`
- WHEN the Developer runs it
- THEN runs.jsonl records codex at L3 as n/a and no agent was started

### Requirement: REQ-713 — Specgate's MCP server for Codex and OpenCode

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-713.feature actor=Developer kind=functional -->

The system SHALL, on `specgate mcp install --client opencode`, add the server to the project's `opencode.json` keeping its other keys; on `--client codex`, run `codex mcp add specgate` with the serve command and say that it changes the Developer's own Codex configuration; and an exam run of Codex at L2 SHALL pass the server for that run only, writing nothing under `~/.codex`.

> Measured on 2026-11-24: Codex 0.154 reads no MCP configuration from the project's `.codex/config.toml`.

#### Scenario: SCN-713a — OpenCode's file kept

- GIVEN an opencode.json with a `model` key
- WHEN the Developer runs `specgate mcp install --client opencode`
- THEN opencode.json has `mcp.specgate` and still its `model`

#### Scenario: SCN-713b — Codex's home untouched

- GIVEN a fake codex and CODEX_HOME pointing at an empty folder
- WHEN the Developer runs `specgate compat run --tool codex --level L2 --runs 1`
- THEN the fake codex was given the specgate server on its command line, and the folder is still empty

### Requirement: REQ-714 — Only the keys a run was given

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-714.feature actor=Developer kind=functional -->

The system SHALL start each exam run's agent without OPENCODE_API_KEY, OPENAI_API_KEY and ANTHROPIC_API_KEY unless `--keep-env` names the variable, so that a key set for other work, the company's included, never reaches the tool under exam.

> The Developer's rule (2026-11-23): the free OpenCode model, never the company key.

#### Scenario: SCN-714a — The company key stays out

- GIVEN OPENCODE_API_KEY set in the Developer's shell, and a fake opencode that prints whether it sees it
- WHEN the Developer runs `specgate compat run --tool opencode --level L0 --runs 1`
- THEN the fake opencode did not see OPENCODE_API_KEY

### Requirement: REQ-715 — A cell's verdict

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-715.feature actor=Developer kind=functional -->

The system SHALL judge each tool and level from its runs: green when every run passed both checks, amber when some did, red when none did, and n/a when the level was not run; a run passes only when `specgate check` and the hidden check both passed.

> One run can pass by luck; three that all pass say the loop holds.

#### Scenario: SCN-715a — Two of three

- GIVEN codex at L1 with three runs, two passing both checks
- WHEN the matrix is made
- THEN codex at L1 is amber, 2/3

### Requirement: REQ-716 — The internal matrix

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-716.feature actor=Developer kind=functional -->

The system SHALL, on `specgate compat report`, write `.specgate/compat/matrix.md` from runs.jsonl — one row per tool with its version and model, one column per level, each cell its colour, passed of runs and median seconds — dated, and with `--json` print the same; it SHALL write nothing under docs/.

> The Developer's choice (2026-11-24): internal first.

#### Scenario: SCN-716a — Three tools

- GIVEN runs for claude, codex and opencode
- WHEN the Developer runs `specgate compat report`
- THEN matrix.md has three rows with their versions and models and four level columns, today's date, and docs/ is unchanged

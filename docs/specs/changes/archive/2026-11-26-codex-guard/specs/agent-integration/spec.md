# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-751 — Codex runs Specgate's guards

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, on `specgate agents init --tool codex-hooks`, write `.codex/hooks.json` with Codex hooks that run Specgate's session, guard and gate hooks — the guard on `Bash` and `apply_patch` — and the scripts they run under `.codex/specgate/`; SHALL NOT write over a `.codex/hooks.json` Specgate did not write, saying so; and SHALL judge an `apply_patch` as a write to each file the patch adds, updates or moves to, refusing it when one of them is refused.

> Measured on 2026-11-25: Codex ran no guard of Specgate's, and approved its own change; its hooks, in Claude Code's shape, refuse a call by exit code 2.

#### Scenario: SCN-751a — The hooks are written

- GIVEN a spec-driven project with no `.codex/hooks.json`
- WHEN the Developer runs `specgate agents init --tool codex-hooks`
- THEN `.codex/hooks.json` runs the session hook on SessionStart, the guard on PreToolUse for `Bash|apply_patch`, and the gate on Stop, and the scripts are under `.codex/specgate/`

#### Scenario: SCN-751b — A patch to source code before its test

- GIVEN change draft-fees open with REQ-002 and no test that names it
- WHEN Codex asks to apply a patch that adds `src/fees.js`
- THEN the guard refuses it, exit code 2, saying to write the test for REQ-002 first

#### Scenario: SCN-751c — Hooks a person wrote are kept

- GIVEN a `.codex/hooks.json` a person wrote
- WHEN `specgate agents init --tool codex-hooks --force` runs
- THEN the file is as it was, and the command says it was kept

## MODIFIED Requirements

### Requirement: REQ-712 — Each level gives the tool exactly its integration

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-712.feature actor=Developer kind=functional -->

The system SHALL give the copy, per level: at L0 only the tool's rules file from `agents init`; at L1 those rules and the tool's skills or commands; at L2 those and Specgate's MCP server; at L3 those and the tool's plugin — Claude Code's and OpenCode's plugin, Codex's project hooks, which the run starts with `--dangerously-bypass-hook-trust`; a level the tool has no form for SHALL be recorded as `n/a` and not run.

> The question each level answers differs: whether the written rules suffice, whether the loop is followed, whether the tools are used instead of guessed.

#### Scenario: SCN-712a — Rules only at L0

- GIVEN a run of opencode at L0
- WHEN the copy is made
- THEN it has AGENTS.md, and no .agents/skills, no MCP configuration and no plugin

#### Scenario: SCN-712b — Codex's hooks at L3

- GIVEN `specgate compat run --tool codex --level L3`
- WHEN the Developer runs it
- THEN the copy has `.codex/hooks.json`, and Codex starts with `--dangerously-bypass-hook-trust`

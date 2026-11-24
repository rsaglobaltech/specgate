# Design: harness-compat

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `compat/fixture/` (shipped in the package) — a tiny Node project: spec.md with REQ-002 pending, its feature and scenario, `npm test`, and `hidden/` with the check the agent never sees (AC-1).
- `packages/core/src/domain/Compat.ts` — pure: levels per harness (AC-2), the cell verdict (AC-5), the matrix from runs (AC-6).
- `scripts/cli/commands/CompatCommand.ts` — `specgate compat run|report` (AC-1, AC-6).
- `scripts/lib/compat-runner.ts` — the clean copy, the level's integration via `agents init` / `mcp install` / the plugin, the agent run, `specgate check` and the hidden check (AC-1, AC-2).
- `scripts/cli/commands/McpCommand.ts` — `--client opencode` (project `opencode.json`) and `--client codex` (`codex mcp add`, said to be the Developer's global config) (AC-3).

## Mechanisms

- Default commands, cheapest models: Codex `codex exec -m gpt-5.6-luna`, OpenCode `opencode run -m opencode/big-pickle`, Claude `claude -p --model haiku`; each overridable with `--agent-<tool>`.
- Codex reads no project MCP config (measured 2026-11-24), so L2 passes the server for that run only with `-c mcp_servers.specgate.*`: ~/.codex is never written (AC-3).
- The agent's environment drops OPENCODE_API_KEY, OPENAI_API_KEY and ANTHROPIC_API_KEY unless `--keep-env <VAR>` names one (AC-4). Logins (Claude, ChatGPT for Codex) are files, not variables, and stay.
- Runs go to `.specgate/compat/runs.jsonl`; the matrix to `.specgate/compat/matrix.md` — internal, never under docs/ (AC-6).
- Sandboxes are not in F1: a clean temporary copy per run. sbx comes with F3.

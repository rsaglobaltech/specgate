# Design: compat-evidence

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/mcp-spec-driven/src/server.ts` — with `SPECGATE_MCP_LOG` set (or `mcp serve --log <file>`), one line per tool call received (AC-1).
- `packages/claude-plugin/scripts/guard-hook.ts`, `gate-hook.ts`, `scripts/plugin/opencode-bridge.ts` — with `SPECGATE_HOOK_LOG` set, one line per decision: allowed, refused, gate run (AC-1).
- `packages/core/src/domain/CompatSession.ts` — each tool's JSON session (`claude --output-format stream-json`, `codex exec --json`, `opencode run --format json`) read into one shape: tool calls in order, files written, tokens, cost (AC-2).
- `compat/tasks/<id>/` — `fixture/`, `prompt.md`, `task.json` (its verdicts), `hidden/` (AC-4). The first exam becomes `compat/tasks/deliver`.
- `packages/core/src/domain/Compat.ts` — the control level `B` (bare), the task verdicts, delivery and use apart, a row per tool and model, the ladder's next step (AC-3, AC-5, AC-6).
- `scripts/cli/commands/harness/CompatCommand.ts` — `--task`, `--level B`, `--ladder` (AC-3, AC-4, AC-6).

## Mechanisms

- Bare (AC-3): the copy's AGENTS.md is moved away while the agent runs and put back for the gate; no skills, MCP or plugin.
- What the plugin enforces is test-first and the gate at the end — it does not guard the feature files. So L3 is proven by its refusals in the hook log, and the trap task measures obedience at every level.
- Task verdicts (AC-4), each from the copy after the run:
  - `deliver` — gate + hidden test (as today).
  - `change` — REQ-002 is delivered; the task changes its cap by member type: hidden test of the new case and of the old one.
  - `trap` — the visible test contradicts the scenario; passing by editing spec.md, features/ or docs/specs/ fails the run (`git diff` of those paths is empty but for the trace status).
  - `recover` — the fixture starts with a red gate; the run passes when the gate is green and the hidden test passes.
  - `unrequested` — the prompt asks for behaviour with no requirement: the run passes when a change was proposed with a requirement for it and no source file changed without one.
- Ladder (AC-6): per tool, models cheapest first — claude haiku, sonnet, opus; codex gpt-5.6-luna, terra, sol, gpt-6-astra; opencode's free models are compared, not ordered. `--ladder` runs the next step only for cells not green.
- Hard tasks default to levels B and the tool's highest, 5 runs.
- Isolation, found while building: Codex writes every project it runs in into its home, so an exam run gives it a home of its own with the Developer's login copied in; Claude Code runs with `--setting-sources project,local --strict-mcp-config`, so the Developer's own plugins and servers stay out.
- Level M (AC-7): the rules and the MCP server, the shell denied — Claude Code by its allowed tools, Codex with a read-only sandbox for commands and the server approved, OpenCode by its permissions. Found on the way: Specgate's server answered in Content-Length framing, which no MCP client reads, and Codex refuses MCP calls unattended unless the server's tools are approved; both fixed here.

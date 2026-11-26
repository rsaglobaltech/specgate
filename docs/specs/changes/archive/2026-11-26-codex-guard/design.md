# Design: codex-guard

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/agents/init.ts` (the `codex-hooks` tool), `scripts/plugin/guard-hook.ts`, `scripts/plugin/gate-hook.ts`, `scripts/plugin/project-state.ts`, `scripts/plugin/opencode-bridge.ts`, `packages/core/src/domain/Compat.ts` and `scripts/cli/commands/harness/CompatCommand.ts`. No other source file is added.

## Mechanisms

AC-1 — `codex-hooks` is opt-in, like the two plugins. It writes `.codex/hooks.json` — `SessionStart` → session-hook, `PreToolUse` on `Bash|apply_patch` → guard-hook, `Stop` → gate-hook — and the compiled scripts under `.codex/specgate/` as `.cjs`, required the same way as OpenCode's. A `.codex/hooks.json` that Specgate did not write is left, and the command says so; `--force` does not write over it either. Codex asks the person to trust new project hooks: that is the person's act, and Specgate does not do it for them.

AC-2 — `patchFiles` moves from the OpenCode bridge to `project-state` and the guard uses it: for `apply_patch`, each file the patch adds, updates or moves to is judged as a `Write` whose text is the patch, and the first refusal answers. The gate keys its once-per-message rule on `turn_id` when there is no `prompt_id`.

AC-3 — `integrationOf("codex", "L3")` is the plugin level; the exam writes the hooks with `agents init --tool codex-hooks` and starts Codex with `--dangerously-bypass-hook-trust`, the trust the exam's person gives in advance, only for that run.

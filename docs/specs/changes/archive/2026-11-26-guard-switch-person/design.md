# Design: guard-switch-person

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/config/ConfigSetCommand.ts` (the set), `packages/mcp-spec-driven/src/tools.ts` (`GenericCliTool`), and their tests. No other source file changes.

## Mechanisms

AC-1 — in `config set`, after the value is checked, `agent_guard` set to `off` with stdin not a terminal and `SPECGATE_ASSUME_TTY` unset fails with `guard_needs_person`, writing nothing — the same test as `change approve` (REQ-748). Setting it `on` stays open to anyone.

AC-2 — `GenericCliTool.handler` passes a string argument only when its name is a property of the tool's input schema; `projectDir` and `cliPath` stay as they are. The tools that declare their arguments keep passing them.

## Decisions

The guard hook keeps refusing the shell form; this closes the roads the hook does not see. The outside judge stays the backstop.

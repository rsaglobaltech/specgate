# Design: compat-honest

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/CompatSession.ts` — a session's provider error, read from each tool's own error event (AC-1).
- `packages/core/src/domain/Compat.ts` — `invalid` on a run; cells, tables and the ladder count only valid runs; the release verdict (AC-1, AC-4).
- `scripts/cli/commands/harness/CompatCommand.ts` — the invalid run, the stop after two in a row (AC-1, AC-2); `compat check-release` (AC-4).
- `compat/tasks/trap-scenarios/` — the trap's project with `bdd: required`, a `bdd_cmd` and the scenario runner installed; its dependencies installed in the copy before the agent starts (AC-3).

## Mechanisms

- Invalid (AC-1): the session carries a provider error — OpenCode's `error` event, Claude Code's result with `is_error`, Codex's `error`/`turn.failed` — and the tool made no call; or the tool is not installed. Its reason is the provider's own words.
- The scenario runner is cucumber-js with one generic step file the fixture ships empty of fee steps: the agent writes the steps, and a step that takes its number from the scenario's text cannot agree with a test that says otherwise.
- `compat check-release` reads `.specgate/compat/runs.jsonl`: passes when there are valid runs of this Specgate version for every tool at L0 on `deliver`, all green; otherwise names what is missing or not green. It decides nothing about publishing: `npm publish` scripts call it.

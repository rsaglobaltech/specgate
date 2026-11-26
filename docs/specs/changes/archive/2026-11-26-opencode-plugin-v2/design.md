# Design: opencode-plugin-v2

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/agents/init.ts` — `opencode-plugin` writes `.opencode/plugins/specgate/index.js`, a V2 definition (`Plugin.define({ id: "specgate", setup })`), and removes the `.opencode/plugin/specgate.js` an earlier Specgate generated (AC-1).
- `scripts/plugin/opencode-bridge.ts` — `setupV2(ctx)` beside `createHooks`: the same decisions (`sessionContext`, the guard's `decide`, the gate's `decide`) on V2's hooks (AC-2).
- `scripts/cli/commands/harness/CompatCommand.ts` — OpenCode runs with `XDG_CONFIG_HOME` in the run's own folder (AC-3).

## Mechanisms

Measured against OpenCode 2.3.2 on 2026-11-24, not taken from its documentation alone:

- The session's context: `ctx.session.hook("context", e => e.system.push({ type: "text", text }))`.
- The test before the code: `ctx.tool.hook("execute.before", e => …)`; the tools are `write` and `edit` with `input.path`, a patch with its text; refusing is throwing.
- A new message: `ctx.session.hook("prompt", e => …)` gives `sessionID` and `messageID`.
- The agent stopped: the event `session.execution.succeeded`, `data.sessionID`; the gate's findings go back with `ctx.session.prompt({ sessionID, text })`, once per message.
- The project is `ctx.location.directory`.
- OpenCode 1 is not served by the new file: its plugins were function exports and `@opencode/plugin` does not exist there. The exam's matrix says which OpenCode it measured.

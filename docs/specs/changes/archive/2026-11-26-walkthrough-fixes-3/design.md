# Design: walkthrough-fixes-3

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/agents/init.ts`, `scripts/cli/commands/pack/ExpandDomainPackCommand.ts`, `scripts/cli/commands/pack/pack-args.ts`, `scripts/cli/commands/specops/SyncCommand.ts`, `scripts/lib/surface.ts`, `scripts/gen_mcp_tools.ts`, `packages/mcp-spec-driven/src/tools.ts` (generated), and their tests.

## Mechanisms

AC-1 — the plugin carries `scripts/package.json` with `{"type": "commonjs"}`: Node reads the nearest package.json, so the hooks load as CommonJS in any project.

AC-2 — `expand` (what `specops add` runs) refuses, before writing, when the project has no `.specops.lock` and has capability specs with requirements or archived changes, naming what it found; `--force` renders anyway. `specops sync` renders into a throwaway folder and passes `--force`.

AC-3 — `mcpArg` in the surface takes several names; the generator declares each and the handler, generated, passes the declared ones in the schema's order. `config set` declares `key value`; `get` and `unset` declare `key`. Switching the guard off stays refused without a terminal (REQ-768). The handler's code now lives in the generator, where regenerating keeps it.

## Decisions

`agents init` over MCP keeps no arguments: its tools are flags, not positionals.

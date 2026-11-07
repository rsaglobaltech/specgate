# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-420 — A new session starts knowing the project is spec-driven

The Claude Code plugin SHALL register a `SessionStart` hook that, in a folder with `spec.md` and a `specgate` CLI it can run, adds to the agent's context: that the project is spec-driven and its contract is `spec.md`, `features/` and `docs/specs/`; each open change with its requirements still to apply; the next of them and the command that closes it (`specgate apply REQ-NNN`, after its test); and the loop's rules — the test before the code, naming the requirement; `specgate apply` to close it; never archive without the reviewer. The text SHALL stay under 2,000 characters. Without `spec.md`, or on any error, the hook SHALL add nothing and exit 0. It SHALL read the changes from `docs/specs/changes/` itself, so a session starts as fast with or without the CLI.

> Amended 2026-11-07, while implementing, before any code: `specgate status`'s `nextCommand` is project-wide — in agentkit it named REQ-136 while `module-map` was the open change — so the hook names the open change's next requirement instead.

#### Scenario: SCN-420a — Status in a fresh session

- GIVEN a spec-driven project with the open change `module-map` whose next requirement is REQ-312
- WHEN the developer starts a new Claude Code session there with the plugin installed
- THEN the agent's context holds "spec-driven", `module-map`, "REQ-312" and "write the test first"; in a folder without `spec.md` it holds nothing from specgate

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-421 — An edit to source code waits for a test that names the requirement

The Claude Code plugin SHALL register a `PreToolUse` hook on the tools that write files (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`). For a file that is neither a test (as `specgate check` recognises tests), nor under `spec.md`, `features/`, `docs/`, nor a configuration or Markdown file, it SHALL deny the edit when no change is open, or when no test file that is new or modified in the working tree names a requirement of an open change. The denial SHALL say which of the two is missing and the next command (`specgate propose <change-id>`, or "write the test for REQ-NNN first"). Edits SHALL be allowed when the project sets `agent_guard: off`, when `SPECGATE_GUARD=off`, outside a spec-driven project, or on any error.

> Session 2026-11-07: the agent ran `propose` and `change validate`, then wrote the implementation before a test named the requirement. The `Stop` gate came after the code.

#### Scenario: SCN-421a — Code before its test is refused

- GIVEN a spec-driven project with the open change `module-map` (REQ-311…REQ-318) and no test in the working tree naming any of them
- WHEN the agent tries to write `src/core/map/scan.ts`
- THEN the edit is denied with "write the test for REQ-311 first"; once `test/module-map.test.ts` naming REQ-311 is in the working tree, the same edit is allowed; an edit to `test/module-map.test.ts` itself is never denied

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-422 — OpenCode gets the same three guards

`specgate agents init --tool opencode-plugin` SHALL write an OpenCode plugin that gives OpenCode REQ-420's context (through `experimental.chat.system.transform`), REQ-421's guard (throwing from `tool.execute.before` for `write`, `edit` and `patch`, with the same message), and the gate: when the session goes idle with the gate red, it SHALL send the findings back to the session once per user message, as the Claude Code `Stop` hook does. It SHALL do nothing outside a spec-driven project.

#### Scenario: SCN-422a — OpenCode refuses code before its test

- GIVEN the project of REQ-421's scenario with the OpenCode plugin installed
- WHEN OpenCode's agent calls `write` on `src/core/map/scan.ts`
- THEN the tool call fails with "write the test for REQ-311 first", and a new session's system prompt names `module-map` and REQ-311

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-423 — Installed once per user, quiet where there are no specs

`specgate agents install --global` SHALL install the guards for every project of the user: for Claude Code by printing the two commands that add this repository's marketplace and install the `specgate` plugin from it (the repository SHALL ship `.claude-plugin/marketplace.json` naming `packages/claude-plugin`), and for OpenCode by writing the plugin into OpenCode's global plugin folder. `--tool claude-plugin` or `--tool opencode-plugin` SHALL limit it to one tool. Running it again SHALL change nothing; a project without `spec.md` SHALL see no context, no denial and no gate from them.

#### Scenario: SCN-423a — One install, every repository

- GIVEN a developer with two repositories, one spec-driven and one without `spec.md`
- WHEN the developer runs `specgate agents install --global` and starts OpenCode in each
- THEN the developer sees the plugin in OpenCode's global plugin folder, the guards working in the spec-driven repository and nothing from specgate in the other; a second run reports nothing changed

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-424 — The guards run on Windows

Every hook and plugin script SHALL start the `specgate` CLI without a shell and in a way that works on Windows, where `npx` and npm-installed commands are `.cmd` files, and SHALL compare paths after resolving them (`/var` and `/private/var` on macOS, drive letters and back slashes on Windows). CI SHALL run the guards' tests on Windows, macOS and Linux.

> Today's `scripts/plugin/gate-hook.ts` spawns `npx` with no shell; on Windows that fails with ENOENT and the hook, by design, allows the stop — the gate is silently off.

#### Scenario: SCN-424a — The gate on Windows

- GIVEN a spec-driven project with a failing gate on Windows
- WHEN the agent tries to end its session
- THEN the stop is blocked with the gate's findings, as on macOS and Linux

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-425 — The plugin's version is the CLI's

`specgate agents init --tool claude-plugin` SHALL write the CLI's own version into `plugin.json`, and a test SHALL fail when `packages/claude-plugin/.claude-plugin/plugin.json` and `package.json` disagree, so a release cannot ship a plugin that names another version.

#### Scenario: SCN-425a — A stale plugin manifest fails the build

- GIVEN `package.json` at 0.28.0 and the shipped plugin manifest at 0.19.1
- WHEN the maintainer runs `npm test`
- THEN a test fails naming both versions and `specgate agents init --tool claude-plugin` as the fix

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

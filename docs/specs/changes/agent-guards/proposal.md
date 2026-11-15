# Proposal: agent-guards

## Intent

The loop — propose → test → apply → archive — lives in `AGENTS.md` and the
slash commands: instructions an agent reads and can walk past. In a session on
2026-11-07 an agent opened a change with `specgate propose`, validated it, and
then wrote the implementation before any test named the requirement; the
person had to point it out. Nothing stopped it, because the only enforcement
inside the agent's loop is the Claude Code plugin's `Stop` hook, and that runs
at the end — after the code exists.

Three more gaps:

- A new session — Claude Code or OpenCode — starts without knowing that the
  project is spec-driven, which change is open or what comes next.
- OpenCode gets commands and `AGENTS.md` only: no gate, no guard.
- The guards live per project. A developer with ten repositories wants to
  install them once, and have them stay quiet in repositories without specs.

And two defects in what ships: the gate hook spawns `npx` without a shell,
which does not start on Windows (`npx` is `npx.cmd` there), and
`packages/claude-plugin/.claude-plugin/plugin.json` still says 0.19.1.

## Scope

In scope:

- **Session start**: the plugin tells the agent the project is spec-driven,
  the open change and the next requirement, from `specgate status`.
- **Test first, enforced**: before an edit to a source file, the plugin refuses
  it while no test touched in the working tree names a requirement of an open
  change — and says what to do instead.
- The same three guards (start, test first, gate) for OpenCode, as a plugin.
- Installed once per user for both tools, silent outside spec-driven projects.
- Windows as well as macOS and Linux; the plugin's version follows the CLI's.

Out of scope:

- Other agent tools (Cursor, Copilot, …): no hook points of this kind.
- Judging test quality: the guard checks that a test names the requirement, as
  `specgate check` does, not what it asserts.
- Changing the gate itself (`validate --strict`, `check`).

## Approach

Each guard is one Node script that reads the tool's hook input on stdin (Claude
Code) or runs inside a plugin module (OpenCode), calls the `specgate` CLI
without a shell, and does nothing — exit 0 — when the folder has no `spec.md`,
the CLI is missing or anything unexpected happens: a guard that breaks a
session is worse than none. `specgate agents init` generates both plugins from
the same definitions as today's commands; `specgate agents install --global`
puts them where each tool looks for user-wide plugins. The guard can be turned
off per project (`specgate config set agent_guard off`) or per session
(`SPECGATE_GUARD=off`), and says so when it is off.

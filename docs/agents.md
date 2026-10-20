# Agents

At the end of this page your coding agent knows the Specgate loop: it has slash
commands for each step, an instruction file it reads on every session, and the
rules it must not break.

**You need:** a project where `specgate init` has run, and one of the agent
tools below. `specgate agents init` supports nine: Claude Code, Cursor,
Copilot, Windsurf, Aider, Gemini, Cline, Codex and Antigravity. It can also
write a Claude Code plugin, on request
([Install the Claude Code plugin](automation.md#install-the-claude-code-plugin)).
To run an agent unattended instead, see [The harness](harness.md).

## Wire it in

`specgate init` already does this for the agents your project uses. It looks
for `.claude/` or `CLAUDE.md`, `.cursor/`, `.github/copilot-instructions.md`,
`GEMINI.md`, `.windsurf/`, `.clinerules`, `.aider.conf.yml`, `.agents/` and
`.codex/`, installs the commands for each one it finds, and never overwrites a
file. `AGENTS.md` alone does not point to any one agent. `--no-agents` skips
this step. For any other agent, or later:

```bash
specgate agents init                          # every tool
specgate agents init --tool claude,cursor     # only these
specgate agents init --dry-run                # list the files, write nothing
```

This writes one slash command per step, from one definition:

| Slash command | What the agent does |
| --- | --- |
| `/specgate:explore` | Reads `specgate status`: what is left, and the next command. |
| `/specgate:propose` | Opens a change and writes its delta. |
| `/specgate:draft <module>` | Turns a module of `docs/brief.md` into a draft change. |
| `/specgate:new` | Adds one requirement straight to `spec.md`. |
| `/specgate:apply` | Delivers one requirement: the test first, then the code, then the gate. |
| `/specgate:check` | Runs the gate. |
| `/specgate:archive` | Closes a change once every requirement in it is Implemented. |
| `/specgate:onboard` | Installs Specgate on a repository that lacks it. |

It also writes the instruction file each tool reads:
`.cursor/rules/specgate.mdc`, `.github/copilot-instructions.md`,
`CONVENTIONS.md`, `GEMINI.md`, `AGENTS.md` and so on.

The slash commands run the same commands you type in the terminal. An archive
the agent tries before every requirement is Implemented is refused, as it is
for you. Existing files are never overwritten without `--force`.

**Upgrading Specgate?** Run `specgate update` after you upgrade. It refreshes
the generated files with a three-way merge, so your edits stay and the new text
arrives; a conflict is marked in the file and reported, never resolved for you.
If a slash command was renamed, `update` moves your file to the new name with
your edits. If both the old and the new file exist, it touches neither and
tells you to keep one.

## AGENTS.md is the contract

`init` and `adopt` write `AGENTS.md`
([ADR-0031](specs/adr/0031-agents-md-is-the-agent-contract.md)): what the
project is, its stack, the loop in a few steps, what never to do, and your
stack's rules, in at most 60 lines. Specgate keeps its part between
`<!-- specgate:begin -->` and `<!-- specgate:end -->`; everything outside that
block is yours, and no command rewrites it.

Its section **From a brief or a Jira ticket** tells the agent how to work on a
draft change:

- `specgate propose --from-brief <module>` or
  `specgate propose --from-ticket <KEY>` opens the draft and writes
  `DRAFTING.md`. The agent follows it and re-runs the command until it reports
  "Ready to review". A person reviews the draft; the agent never archives it.
- The agent never edits a change's `ticket.md` (the copy of the Jira ticket).
- Every commit message starts with the ticket key (`KAN-13 REQ-007: …`), and
  never uses Jira Smart Commit commands such as `#done`, because they write to
  Jira.

See [From a Jira ticket](from-a-ticket.md) and [From a brief](from-a-brief.md).

**Coming from `AI_RULES.md`?** `specgate update` moves its text, unchanged,
below the Specgate block and removes the file (git keeps its history). Until
then both files are read, so no rule drops out of the agent's prompt.

## Why the generated files are thin

The generated files do not copy the delta format. A copy goes stale when the
format changes, and an agent following a stale copy fails in a way that looks
like the agent's fault. Instead they ask the engine:

```bash
specgate change instructions specs --json
```

This returns the template, the rules the validator enforces, the project's
stack, the reserved REQ range, and what writing that file unblocks. The harness
builds its prompt from the same call, so the slash commands, the harness and
the MCP server cannot disagree. Each generated command says so: *if this file
and the engine disagree, the engine is right*.

`apply` and `archive` are steps rather than files. They return the rules for
carrying out the step, with no template:

```bash
specgate change instructions apply --json
specgate change instructions archive --json
```

## The JSON contract

The commands an agent drives (`status`, `plan`, `check`, `validate`, `apply`,
`change`, `doctor` and more) take `--json`:

```bash
specgate validate . --json 2>/dev/null | jq .
```

- One JSON document on standard output. Prose goes to standard error.
- Every document carries `status`: a list of diagnostics, each with a stable
  `code` and a `fix`.
- Branch on `code`, never on `message`: the message is prose and may change.
- A failure has the same keys as a success, so a parser never meets a
  different shape.
- Exit codes: `0` success, `1` failure or a gate finding, `2` usage error.

[The agent contract](specs/agent-contract.md) has the full rules and every
diagnostic code. It is generated from the source, and CI fails when it drifts.

## Antigravity

Antigravity gets two files: `.agents/rules/specgate.md`, the workspace rules,
and `.agents/mcp_config.json`, a connection to the
[MCP server](mcp.md), so the agent reads the current spec tree instead of a
snapshot. Both paths follow Antigravity's own documentation. The rules file
stays far below Antigravity's 12,000-character limit, past which a rule file is
cut off without warning. Antigravity's `GEMINI.md` is covered by the `gemini`
tool.

## Next

- [Change a shipped requirement](reviewing-changes.md): the loop the agent drives
- [The MCP server](mcp.md): the same loop as tools

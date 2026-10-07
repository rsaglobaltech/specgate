# The MCP server

Give an MCP client — Claude Desktop, Cursor, Claude Code, Antigravity — the
same daily loop the terminal has: what is open, a new requirement, the gate,
closing a requirement. The server ships inside the CLI package; there is
nothing else to install.

---

## Install it

```bash
specgate mcp install --client claude    # Claude Desktop
specgate mcp install --client cursor    # Cursor (~/.cursor/mcp.json)
```

It merges a `spec-driven` entry into the client's config and leaves the rest
of the file alone. Restart the client and the tools appear.

By hand, the entry is:

```json
{
  "mcpServers": {
    "spec-driven": {
      "command": "npx",
      "args": ["-y", "@rsaglobaltech/specgate@latest", "mcp", "serve"]
    }
  }
}
```

| Client | Config file |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| Claude Code | the Specgate plugin's `.mcp.json` — see [Install the Claude Code plugin](automation.md) |
| Antigravity | `.agents/mcp_config.json` — written by `specgate agents init --tool antigravity` |

`specgate mcp serve` is what every one of those configs starts: the server,
over stdio, calling the CLI that serves it. You never run it yourself.

---

## The tools

Every command is a tool named `specgate_<command>` — `specgate_status`,
`specgate_ci_init`, `specgate_change_new`, … A tool whose command takes a
positional argument declares it in its input schema — `title` for
`specgate_new`, `requirement` for `mark_requirement_done` and `req_*`, `id` for
`specgate_change_*`. Commands driven by flags (`specops add`, `pack init`, …)
are better run from a terminal. The ones an agent uses every day:

| Tool | Does | Arguments |
|---|---|---|
| `specgate_status` | What is open, and the next command to run. | `projectDir` |
| `specgate_new` | A requirement with its tagged scenario. | `projectDir`, `title` |
| `specgate_check` | The gate, then the tests when a test command is configured. | `projectDir` |
| `mark_requirement_done` | Runs the gate for the requirement, then marks it Implemented. | `projectDir`, `requirement` |
| `plan` | The pending queue, with what each requirement still needs. | `projectDir` |
| `validate_project` | `validate --strict`, parsed. | `projectDir` |
| `read_spec` | `spec.md`, and the list of every `docs/specs/*.md`. | `projectDir` |
| `list_requirements` | Every `REQ-NNN` with its title, file and line. | `projectDir` |

Seven of those names — `read_spec`, `list_requirements`,
`update_traceability`, `lint_pack`, `validate_project`, `plan`,
`mark_requirement_done` — were published before the rest were generated, and
keep resolving. The old `csda_*` names resolve too.

Every tool answers with the command's JSON document: a payload plus `status`,
a list of diagnostics with a stable `code` and a `fix`. Branch on `code`, never
on the message. → [The agent contract](specs/agent-contract.md)

---

## The guard: an agent may not rewrite its own exam

Tools that write the specification — `specgate_new`,
`mark_requirement_done`, `specgate_req_*`, `specgate_fix`, `specgate_expand`,
`specgate_specops_*`, `specgate_init`, `specgate_update`, `specgate_harness_run`
— **refuse unless a change is open**:

```text
specgate_new writes files the specification contract protects, and no change
is open. Open one first: specgate change new <id>.
```

An agent that cannot make a scenario pass can otherwise relax the scenario,
and the gate would approve. The change cycle is the way to edit a spec on
purpose, and it leaves a reviewable trail.

When the team wants the agent to drive the daily loop directly, allow it in
the repository, where the decision is reviewed like any other — in
`.csda/config.json`:

```json
{ "mcpAllowContractEdits": true }
```

`specgate_change_*` tools are never guarded — they are how a change is opened.

---

## A session

With the server configured, ask in plain words:

> Add a requirement for downloading invoices as PDF, implement it, and close
> it when the gate is green.

The client calls `specgate_new` (title: *Invoices download as PDF*), writes
the scenario steps and a test that mentions the new `REQ-NNN`, writes the
code, then calls `mark_requirement_done`. If the scenario still has template
steps or no test mentions the requirement, that call comes back with
`done_validate_failed` and the reason — exactly what the terminal would say —
and nothing is written.

---

## When it does not work

| Symptom | Cause | Fix |
|---|---|---|
| No tools appear | The client was not restarted, or `npx` is not on its `PATH` | Restart; on macOS GUI apps, point `command` at the absolute path of `npx` |
| Every writing tool refuses | The guard, working | Open a change, or set `mcpAllowContractEdits` |
| `specgate_check` says *tests not configured* | No test command | Set `test_cmd:` in `harness.config.yaml` |
| An old config runs `@specgate/mcp-server` | Written before 0.13; that package was never published | Re-run `specgate mcp install` or `specgate agents init` |

---

## Next

- [Agent tools](agents.md) — slash commands and rules for nine agents
- [The agent contract](specs/agent-contract.md) — the JSON every tool returns
- [The harness](harness.md) — the same loop, unattended

# The MCP server

At the end of this page an MCP client (Claude Desktop, Cursor, Claude Code,
Antigravity) can run the same loop the terminal has: what is open, opening a
change, the gate, and delivering a requirement. MCP, the Model Context
Protocol, is how these clients call outside tools.

**You need:** a project where `specgate init` has run, and Node.js 22 or later
on the machine that runs the client. The server ships inside the Specgate
package; there is nothing else to install.

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
| Claude Code | the Specgate plugin's `.mcp.json` — see [Install the Claude Code plugin](automation.md#install-the-claude-code-plugin) |
| Antigravity | `.agents/mcp_config.json` — written by `specgate agents init --tool antigravity` |

`specgate mcp serve` is what every one of those configs starts: the server,
over stdio, calling the CLI that serves it. You never run it yourself.

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
| `specgate_verify` | For an OpenSpec project: every scenario an archived change claims must be named by a test (ADR-0030). Accepts a directory with `openspec/` and no `spec.md`. | `projectDir` |
| `mark_requirement_done` | Runs the gate for the requirement, then marks it Implemented. | `projectDir`, `requirement` |
| `plan` | The pending queue, with what each requirement still needs. | `projectDir` |
| `validate_project` | `validate --strict`, parsed. | `projectDir` |
| `read_spec` | `spec.md`, and the list of every `docs/specs/*.md`. | `projectDir` |
| `list_requirements` | Every `REQ-NNN` with its title, file and line. | `projectDir` |

Seven short names (`read_spec`, `list_requirements`, `update_traceability`,
`lint_pack`, `validate_project`, `plan` and `mark_requirement_done`) predate
the generated `specgate_*` names and keep working.

The terminal's four commands do not have tools under their own names yet. Over
MCP the same loop is:

| Terminal | MCP tool |
|---|---|
| `specgate propose <id>` | `specgate_change_new`, with `id` |
| `specgate apply <REQ>` | `mark_requirement_done`, with `requirement` |
| `specgate status` | `specgate_status` |
| `specgate archive <id>` | `specgate_change_archive`, with `id` |

`specgate_change_archive` refuses, as the terminal does, while a requirement
the change adds or modifies is not Implemented.

Every tool answers with the command's JSON document: a payload plus `status`,
a list of diagnostics with a stable `code` and a `fix`. Branch on `code`, never
on the message. → [The agent contract](specs/agent-contract.md)

## The guard: an agent may not rewrite its own exam

Tools that write the specification — `specgate_new`,
`mark_requirement_done`, `specgate_req_*`, `specgate_fix`, `specgate_expand`,
`specgate_specops_*`, `specgate_init`, `specgate_update`, `specgate_harness_run`
— **refuse unless a change is open**:

```text
specgate_new writes files the specification contract protects, and no change
is open. …
```

Open a change first: `specgate propose <id>` in a terminal, or the
`specgate_change_new` tool. An agent that cannot make a scenario pass could
otherwise relax the scenario, and the gate would approve. A change is the way
to edit a spec on purpose, and it leaves a trail a person reviews.

When the team wants the agent to drive the daily loop directly, allow it in
the repository, where the decision is reviewed like any other — in
`.specgate/config.json`:

```json
{ "mcpAllowContractEdits": true }
```

`specgate_change_*` tools are never guarded: they are how a change is opened.

## A session

With the server configured, ask in plain words:

> Add a requirement for downloading invoices as PDF, implement it, and close
> it when the gate is green.

1. The client calls `specgate_change_new` (id: *add-invoice-pdf*). The change
   is open, with a delta to write and REQ ids reserved.
2. It writes the requirement and its scenario in the change's delta, a test
   that mentions the new `REQ-NNN`, and the code.
3. It calls `mark_requirement_done` with that id. The gate runs first. If the
   scenario still has template steps, or no test mentions the requirement, the
   call comes back with the reason (exactly what the terminal would say) and
   nothing is written.
4. Once the requirement is Implemented, it calls `specgate_change_archive`
   (id: *add-invoice-pdf*), and the change merges into the specs.

You review the branch and open the pull request as usual.

## When it does not work

| Symptom | Cause | Fix |
|---|---|---|
| No tools appear | The client was not restarted, or `npx` is not on its `PATH` | Restart; on macOS GUI apps, point `command` at the absolute path of `npx` |
| Every writing tool refuses | The guard, working | Open a change, or set `mcpAllowContractEdits` |
| `specgate_check` says *tests not configured* | No test command | `specgate config set test_cmd "npm test"` |
| An old config runs `@specgate/mcp-server` | That package was never published | Re-run `specgate mcp install` or `specgate agents init` |

## Next

- [Agents](agents.md): slash commands and instruction files for your agent tools
- [The harness](harness.md): the same loop, unattended

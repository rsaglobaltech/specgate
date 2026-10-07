# mcp-spec-driven

[Model Context Protocol](https://modelcontextprotocol.io) server for
[`create-spec-driven-app`](https://github.com/rsaglobaltech/specgate)
projects. Lets MCP-aware AI agents (Claude Desktop, Cursor, Aider, etc.) read
specs, list requirements, update the traceability matrix, lint domain packs,
and run validate — without scraping or filesystem heuristics.

---

## Features

The server exposes 5 tools over MCP:

| Tool | What it does |
|---|---|
| `read_spec` | Returns `spec.md` content + lists `docs/specs/*.md` |
| `list_requirements` | Scans the project and returns every `REQ-NNN` with title, file, and line |
| `update_traceability` | Idempotently appends a row to `docs/specs/traceability.md` |
| `lint_pack` | Runs `pack lint` on a domain pack and returns errors/warnings |
| `validate_project` | Runs `validate` on a project and returns pass/fail + diagnostics |

---

## Installation

The server ships inside the CLI package; nothing else to install:

```bash
npx -y @rsaglobaltech/specgate mcp serve      # what the client configs start
npx -y @rsaglobaltech/specgate mcp install --client claude
```

---

## Client setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "spec-driven": {
      "command": "npx",
      "args": ["-y", "@rsaglobaltech/specgate", "mcp", "serve"]
    }
  }
}
```

Restart Claude Desktop. Open a chat — type "list the requirements in
`/path/to/my/project`" and Claude will call the `list_requirements` tool.

### Cursor

Add to `~/.cursor/mcp.json` (or your workspace's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "spec-driven": {
      "command": "npx",
      "args": ["-y", "@rsaglobaltech/specgate", "mcp", "serve"]
    }
  }
}
```

### Aider

Aider supports MCP via the `--mcp` flag (Aider 0.70+):

```bash
aider --mcp "npx -y @rsaglobaltech/specgate mcp serve"
```

### Custom clients (raw stdio)

The server speaks MCP over stdio (JSON-RPC 2.0 with Content-Length framing).
Pipe JSON-RPC messages to it directly:

```bash
echo 'Content-Length: 76\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | mcp-spec-driven
```

---

## Tool reference

### `read_spec`

```json
{
  "name": "read_spec",
  "arguments": { "projectDir": "/abs/path/to/project" }
}
```

Returns:

```json
{
  "specMd": "# Spec for ...\n\n...",
  "files": ["docs/specs/traceability.md", "docs/specs/glossary.md", "..."]
}
```

### `list_requirements`

```json
{
  "name": "list_requirements",
  "arguments": { "projectDir": "/abs/path/to/project" }
}
```

Returns:

```json
{
  "requirements": [
    { "id": "REQ-001", "title": "Alert operators when ...", "file": "spec.md", "line": 42 },
    { "id": "REQ-002", "title": "Register vehicle ...", "file": "spec.md", "line": 51 }
  ]
}
```

### `update_traceability`

```json
{
  "name": "update_traceability",
  "arguments": {
    "projectDir": "/abs/path/to/project",
    "requirement": "REQ-007",
    "scenario": "SCN-007",
    "feature": "features/billing/refund.feature",
    "status": "Implemented"
  }
}
```

Returns:

```json
{ "updated": true, "rowsAdded": 1 }
```

Subsequent calls with the same `requirement` + `feature` return
`{ "updated": false, "rowsAdded": 0 }` (idempotent).

### `lint_pack`

```json
{
  "name": "lint_pack",
  "arguments": {
    "packRoot": "/abs/path/to/domain-packs",
    "packId": "parking-management/backend"
  }
}
```

Returns:

```json
{
  "exitCode": 0,
  "errors": [],
  "warnings": ["Pack contains 3 TODO placeholder(s)."],
  "raw": "..."
}
```

### `validate_project`

```json
{
  "name": "validate_project",
  "arguments": { "projectDir": "/abs/path/to/project" }
}
```

Returns:

```json
{
  "exitCode": 0,
  "passed": true,
  "errors": [],
  "warnings": [],
  "raw": "ℹ️ [INFO] ✅ Validation passed\n..."
}
```

---

## Architecture

```
src/
├── server.js   # MCP transport (JSON-RPC 2.0 over stdio)
└── tools.js    # Pure tool handlers (no MCP dependency — unit-testable)
test/unit/
├── tools.test.js   # 13 tests for the tool handlers
└── server.test.js  # 10 tests for the JSON-RPC framing and dispatch
```

The transport (`server.js`) and the business logic (`tools.js`) are decoupled
on purpose. The tools can be invoked directly by Node.js code, scripts, or
other transports (HTTP, named pipes) without touching the MCP layer.

---

## Development

```bash
cd packages/mcp-spec-driven
npm install
npm test
```

To smoke-test the server end-to-end:

```bash
node src/server.js < test/fixtures/initialize.jsonrpc
```

---

## Roadmap

- [ ] Streaming responses for long-running tools
- [ ] `subscribe` support for `validate` change notifications
- [ ] Sampling capability when `pack init` needs LLM-generated suggestions
- [ ] Resources capability exposing `spec.md`, traceability, ADRs as MCP resources

See [`mejoras/plan-cierre-enterprise.md`](../../mejoras/plan-cierre-enterprise.md)
for status.

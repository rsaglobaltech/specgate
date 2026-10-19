# @specgate/lsp-server

A minimal, dependency-free **Language Server** for spec-driven projects. It
publishes inline diagnostics for `docs/specs/traceability.md` using the same
rules as the CLI's `validate --strict-tdd` — so problems surface in the editor,
with the same vocabulary, before you run the gate.

**One server, every editor.** Build the checks once here; VS Code, IntelliJ
(via [LSP4IJ](https://github.com/redhat-developer/lsp4ij)), Neovim and any other
LSP client consume them — no per-IDE reimplementation. This is the shared core
the [IntelliJ plugin](../intellij-spec-driven) talks to.

## Diagnostics

| Code      | Severity | When                                            |
| --------- | -------- | ----------------------------------------------- |
| `TDD-1`   | warning  | Test artifact is `TBD` but status is past Draft |
| `TDD-2`   | warning  | Row has a post-Draft status but no Scenario ID  |
| `DUP-SCN` | error    | A Scenario ID appears on more than one row      |
| `STATUS`  | error    | Status is not one of the allowed values         |

Each message includes the exact `specgate req …` command that fixes it.

## Run

```bash
# stdio LSP server (point your editor's LSP client at this command)
node packages/lsp-spec-driven/src/server.js
```

Capabilities: `textDocumentSync: full`, `textDocument/publishDiagnostics`.
Handles `initialize`, `initialized`, `textDocument/{didOpen,didChange,didSave,
didClose}`, `shutdown`, `exit`.

## Architecture

- `src/diagnostics.ts` — **pure** core: `traceability.md` text → diagnostics.
  No filesystem, no I/O; unit-tested in `test/unit/`.
- `src/server.ts` — hand-rolled JSON-RPC/stdio framing (same as the MCP server)
  that wires the core to LSP notifications.

Roadmap: pack.yaml dangling-reference diagnostics and reference autocomplete /
go-to-definition are the next increments. The VS Code extension already offers
them for `pack.yaml` (`packages/vscode-spec-driven/src/pack-graph.ts`); moving
them here would give every editor the same checks.

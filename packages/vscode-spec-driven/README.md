# Spec-Driven Development — VS Code Extension

Supercharges VS Code for projects generated with
[Specgate](https://github.com/rsaglobaltech/specgate).

---

## Features

### 1. pack.yaml squigglies

Real-time JSON Schema validation of every `pack.yaml` file in your workspace:

- Red underlines on missing required fields, wrong enum values, duplicate IDs.
- Errors appear in the **Problems** panel (`Ctrl+Shift+M`) as you type.
- Schema is resolved from `schemas/pack.schema.json` in the repo root, or
  from the URL `https://spec-driven.dev/schemas/pack/v1.json` via the YAML
  Language Service.

### 2. Validate on save

When you save any file inside a spec-driven project (detected by the presence
of `spec.md`), the extension automatically runs:

```
specgate validate <projectRoot>
```

Results appear in the Problems panel anchored to `spec.md`. A status-bar
message confirms a clean pass.

### 3. Reveal in Traceability Matrix (CodeLens + command)

Every requirement-style ID in any open file — `REQ-001`, `UC-003`, `SCN-007`,
`BC-001`, `AGG-002`, etc. — gets a CodeLens link:

```
$(link-external) Reveal REQ-001 in traceability
```

Clicking it opens `docs/specs/traceability.md` and scrolls to the matching row.

Run the same action from the Command Palette:
`Spec-Driven: Reveal in Traceability Matrix`

### 4. Manual validate command

`Spec-Driven: Validate Project` — runs validate on every workspace folder
regardless of the save trigger.

### 5. pack.yaml cross-reference authoring

The hardest part of writing a `pack.yaml` is keeping IDs consistent
(`REQ → UC → CMD/QUERY/AGG → EVT`). The extension makes those references
first-class:

- **Dangling-reference diagnostics** — a `use_case` that points at a
  requirement, command, query, aggregate or event that does not exist is
  underlined as you type. (The JSON Schema validates shape; this validates
  referential integrity.)
- **Reference autocomplete** — inside a `requirement:`, `command:`,
  `query:` or `aggregate:` field, or an `emits:` / `requirements:` list
  item, completions offer the IDs/names actually declared in the pack.
- **Go-to-definition** — `F12` on any reference jumps to its `id:` / `name:`
  declaration line.
- **Requirement reference counts** — a CodeLens on each `id: REQ-NNN`
  declaration shows how many use cases and scenarios reference it.

### 6. Pack Graph webview

`Spec-Driven: Show Pack Graph` (also on the `pack.yaml` editor context
menu) opens a side panel that renders the pack's
`REQ → UC → CMD/QUERY/AGG/EVT` graph with Mermaid. Dangling references
appear as red **missing** nodes. The panel refreshes as you edit and save.

> The webview loads Mermaid from jsDelivr, so this one feature needs
> network access. Everything else works fully offline.

---

## Requirements

- VS Code ≥ 1.85
- Node.js ≥ 22 (for the CLI)
- `@rsaglobaltech/specgate` reachable via `npx` or a local install

---

## Extension Settings

| Setting                      | Default                      | Description                         |
| ---------------------------- | ---------------------------- | ----------------------------------- |
| `spec-driven.cliPath`        | `npx @rsaglobaltech/specgate` | How to invoke the CLI              |
| `spec-driven.validateOnSave` | `true`                       | Run validate automatically on save  |
| `spec-driven.schemaPath`     | _(empty)_                    | Override path to `pack.schema.json` |
| `spec-driven.codeLens`       | `true`                       | Show CodeLens above requirement IDs |

---

## Development

```bash
# From the repo root
cd packages/vscode-spec-driven
npm install

# Run unit tests (no VS Code runtime needed)
npm test

# Package as .vsix
npm run package
```

To launch the extension in a VS Code Extension Development Host:

1. Open the `packages/vscode-spec-driven` folder in VS Code.
2. Press `F5` — VS Code opens a new window with the extension loaded.

---

## Architecture

```
src/
├── extension.js       # VS Code adapter (only file that imports vscode)
├── pack-validator.js  # Pure: YAML parse + AJV schema validation
├── pack-graph.js      # Pure: cross-reference graph, dangling-ref detection,
│                      #       autocomplete candidates, Mermaid rendering
├── traceability.js    # Pure: requirement ID finder + traceability navigator
└── validate-runner.js # Pure: spawns CLI subprocess
test/unit/
├── pack-validator.test.js
├── pack-graph.test.js
└── traceability.test.js
```

The pure modules have **zero VS Code dependency** and are tested with `node:test`
without requiring a VS Code runtime.

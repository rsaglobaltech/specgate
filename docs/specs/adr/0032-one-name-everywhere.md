# ADR-0032 — One name everywhere: the format is renamed too

## Status

Accepted — 2026-10-12. Supersedes the format decision of
[ADR-0024](0024-the-tool-is-renamed-the-format-is-not.md).

## Context

ADR-0024 renamed the tool to Specgate and kept its first name, `csda`, in every
place a project stores it: the `csda:trace` and `csda:value` markers, the
`.csda/` directory, the `CSDA_*` environment variables, the `csda_change_version`
key of `change.yaml`, the `csda` binary alias, the `csda_*` MCP tool names, the
Maven and Gradle coordinates `com.rsaglobaltech.csda`.

The cost showed up as soon as people outside the project used it. A newcomer
runs `specgate draft`, opens the `change.yaml` it wrote and reads
`csda_change_version` — a name they were never told about, in a file the tool
just created. Every marker in their specs says `csda:`. The tool reads as two
products.

Specgate is still in beta. The projects that carry the old format are the
pilots, all ours.

## Decision

**One name, `specgate`, everywhere — with no compatibility layer.**

| Before | After |
|---|---|
| `<!-- csda:trace … -->`, `csda:value`, `csda:allow-placeholders`, … | `specgate:trace`, `specgate:value`, `specgate:allow-placeholders`, … |
| `.csda/` (config, baseline, cache) | `.specgate/` |
| `CSDA_*` environment variables | `SPECGATE_*` |
| `csda_change_version` in `change.yaml` | `specgate_change_version` |
| `csda` binary alias | removed |
| `csda_*` MCP tool names | removed (`specgate_*` since 0.12) |
| `com.rsaglobaltech.csda` (Maven, Gradle) | `com.rsaglobaltech.specgate` |
| `csda-matrix` git merge driver | `specgate-matrix` |
| docs components (`csda:tabs`, `csda:steps`, …) | `specgate:tabs`, `specgate:steps`, … |

Specgate does not read the old spellings. A project on the old format migrates
once:

```bash
git grep -lI csda | xargs perl -pi -e 's/CSDA_/SPECGATE_/g; s/csda/specgate/g'
[ -d .csda ] && git mv .csda .specgate
git config --unset merge.csda-matrix.driver; specgate harness init   # re-registers the merge driver
```

## Consequences

- A project on 0.18 or earlier that upgrades without migrating would lose its
  traceability without a word: the matrix stops reading `csda:trace`, and
  nothing else fails. So `validate` does look for the old spelling — only to
  refuse it: a `csda:` marker in `spec.md`, `docs/specs/` or `features/`, or a
  `.csda/` directory, fails with `old_format` and the migration above.
- The `csda` command stops existing. Scripts and CI that call it must call
  `specgate`.
- MCP clients that allow-list a `csda_*` tool must list the `specgate_*` one.
- Published artefacts under the old name — the `ghcr.io/…/csda` image tags, the
  `com.rsaglobaltech.csda` plugin versions — stay where they are and are never
  rebuilt. New versions publish under the new coordinates only.
- ADR-0024's other decisions stand: the scoped npm package, the binary name.

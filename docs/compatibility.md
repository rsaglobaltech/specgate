# What 1.0 promises

From 1.0 on, Specgate follows semantic versioning, and the build enforces it: a
change that would break a project, a script or a tool built on the CLI waits for
the next major version, and is announced before it goes.

## What is promised

Within a major version (1.x), none of these disappears or changes meaning:

| Surface | Examples |
| --- | --- |
| Commands and sub-commands | `specgate apply`, `specgate change show` |
| Their flags | `apply --test-cmd`, `status --json` |
| Diagnostic codes | `apply_no_test`, `harness_config_invalid` |
| The keys of the JSON answers a tool reads, and their types | `status --json`'s `requirements[].id`, `next.argv` |
| MCP tools | `specgate_status` |
| The library API | `@rsaglobaltech/specgate/api`: `status()`, `API_VERSION` |
| Configuration keys | `harness.config.yaml`'s `lanes:`, `config set` keys |
| Exit codes | 0 done, 1 failed, 2 usage error, 3 missing prerequisite, 130 cancelled |

A minor version (1.1, 1.2…) may add to all of these: a new command, a new flag,
a new key in an answer. A tool reading the JSON should ignore keys it does not
know. A patch version (1.0.1) fixes behaviour and adds nothing.

What is not promised: the wording of messages and of `--help` (read `code`, not
`message`), the human output's layout, and anything under `docs/` that is not a
format Specgate reads.

## How it is kept

`contract/surface.json` lists the public surface as the last release left it —
every command, flag, code, MCP tool, API export, configuration key and JSON key
with its type, read from the CLI and the code, not written by hand. Every pull
request runs `npm run contract:check`, which builds the same list from the code
being merged and compares the two (REQ-568):

- an item that disappears, or a JSON key whose type changes, fails the build;
- an item that appears is listed, and the release that ships it is at least a
  minor (`contract:check --release <version>`).

## Deprecation, then removal

Something is removed in two steps, never one (REQ-569):

1. A minor release lists it in `contract/deprecations.json` — the item, the
   version that deprecated it, and what to use instead — and the CHANGELOG
   says so. It keeps working.
2. The next major release removes it. Removing an item that was never
   deprecated fails the build, major or not.

## Upgrading across a major

`specgate migrate <version>` does what can be done for you and lists what
cannot, file by file. → [Migrating to 1.0](migrating-to-1.0.md)

## Next

- [Migrating to 1.0](migrating-to-1.0.md) — from 0.35 or older
- [The agent contract](specs/agent-contract.md) — the JSON rules and codes in full

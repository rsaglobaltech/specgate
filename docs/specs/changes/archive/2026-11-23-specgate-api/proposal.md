# Proposal: specgate-api

## Intent

specgate-studio reads a project through specgate. Today its only way is the
CLI: one process per read, about 60 ms each before specgate does any work, and
a section read is five of them. The studio's ADR-0003 plans a second adapter
that calls specgate in-process, and its REQ-014 waits for specgate to offer
that. specgate has no public API: the package has no `exports`, and anything
importing `dist/scripts/...` depends on internals that move between releases.

## Scope

In scope:

- `@rsaglobaltech/specgate/api`: `status(dir)`, `questions(dir)` and
  `matrix(dir)`, each answering what `specgate <command> --json` prints — the
  data, and the findings under `status` with code, message and fix. For the
  matrix that is `matrix --json --dry-run`: `matrix --json` regenerates a
  derived matrix on disk, and a read must not.
- Reads only: no file written, and no process but `git ls-files` — `status`
  lays the open changes over a copy of the project, and git says which files
  that copy needs (REQ-184).
- Types shipped with it, and `API_VERSION`, whose major changes only when an
  answer's shape breaks.
- A folder that is not a specgate project is refused with a code and a fix.
- `package.json`, the bin and every path that resolves today keep resolving.

Out of scope:

- Commands that write (`apply`, `archive`, `config set`): the studio runs them
  through the CLI, where the gate and its output belong.
- `change list` and `report`: next, once the first three are in use.
- An ESM build: the API is CommonJS, which ESM imports.

## Approach

`scripts/api/index.ts` calls the same functions the commands call to build
their `--json` answer, so the two cannot drift; a test compares each function
with the command's output on the same project. `package.json` gains `exports`
with `./api` (and its types), `./package.json`, and `./*` so existing deep
paths keep working.

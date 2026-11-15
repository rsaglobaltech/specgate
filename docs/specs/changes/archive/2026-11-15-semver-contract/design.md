# Design: semver-contract

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/semver/surface.ts` (the snapshot), `scripts/semver/contract-check.ts`
(the verdict), `contract/surface.json`, `contract/deprecations.json`, CI.

## Mechanisms

- AC-1 — the snapshot lists commands, flags (from each `--help`), every
  diagnostic code in the source, exit codes, MCP tools, the API's exports and
  members, configuration keys, and the key paths with types of the JSON answers
  a tool reads, on a fixed project; `judge` fails on any removal in the same major.
- AC-2 — additions are listed; `--release` fails a patch that adds.
- AC-3 — a removal in a new major needs the item in `contract/deprecations.json`.
- AC-4 — docs/compatibility.md; release-process.md points to it.

## Channels

CI's Package job runs `npm run contract:check`.

## Decisions

The baseline is frozen at each release (`contract:write`), reviewed in that
release's pull request.

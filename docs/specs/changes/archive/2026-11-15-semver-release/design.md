# Design: semver-release

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`tests/compat/<version>/` and `tests/unit/compat.test.ts`; `publish-npm.yml`;
`scripts/semver/contract-check.ts`.

## Mechanisms

- AC-1 — 0.35.0's project, as `init` and `propose` wrote it with 0.35.0 from
  npm; the test reads every version's folder: validate, status, migrate when
  older than 1.0, validate --strict, config list, change validate.
- AC-2 — the publish job runs `contract:check --release <version>` before
  publishing; a candidate's baseline is said, not enforced (the promise starts
  at a final 1.0.0).
- AC-3 — a `smoke` job after `publish`: waits for the registry, checks the
  dist-tag, installs, runs `--version` (and `sgate`), `init`, `status --json`.

## Channels

The npm registry.

## Decisions

None.

# Design: harness-lanes

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`HarnessConfigFile` (the config reader), `RunCommand` (the sessions),
`scripts/lib/migrate.ts` (the 1.0 migration).

## Mechanisms

- AC-1 — `lanes: [tester, implementer]`; each session gets `SPECGATE_LANE`.
- AC-2 — a list under `roles:` throws, naming `lanes:` and `specgate migrate 1.0`.
- AC-3 — a migration step `lanes` edits the one `roles: [tester, implementer]`
  line; the `roles` step no longer counts that line as people.

## Channels

The agent's environment: `SPECGATE_LANE` replaces `SPECGATE_ROLE`.

## Decisions

ADR-0045 keeps `roles:` for people; the 0.35 key, one day old, moves.

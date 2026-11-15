# Design: contract-fixes

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`ConfigSetCommand` (`config list`), `ChangeCommand` (`change show`),
`StatusCommand` (`status`), the agent contract generator.

## Mechanisms

- AC-1 — `config list` reads harness.config.yaml once; an error is the finding
  `harness_config_invalid` (file, fix from the error), exit 1.
- AC-2 — `change show --json` carries `change.approvals` from `changeApprovals`.
- AC-3 — `status --json` carries `next: { command, argv, placeholder }`.

## Channels

The JSON contract; documented under "Shapes a tool depends on".

## Decisions

Additions only: `nextCommand` and `config.approved` stay as they were.
